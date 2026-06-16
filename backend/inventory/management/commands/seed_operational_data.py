import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.models import (
    BillingNote,
    BillingNoteLine,
    Category,
    CreditNote,
    CreditNoteLine,
    Customer,
    PaymentBatch,
    PaymentBatchLine,
    Product,
    ProductUnitConversion,
    Purchase,
    PurchaseDocument,
    PurchaseItem,
    Quotation,
    QuotationItem,
    QuotationItemSupplier,
    Sale,
    SaleDocument,
    SaleItem,
    SaleItemAllocation,
    Supplier,
)
from inventory.services import (
    SALE_STOCK_DEDUCTED_STATUSES,
    allocate_sale_item_fifo,
    build_stock_report,
    get_available_stock_by_product_id,
    get_sale_status_from_item_statuses,
)


VAT_RATE = Decimal("0.07")
CENT = Decimal("0.01")

# Three years of operational history so every prediction window (daily demand,
# lead time, cycling interval, reorder point) and the dashboard reorder-history
# graph (last 3 reorders per product) has a deep, real track record behind it.
HISTORY_DAYS = 1095

# ── Product behaviour archetypes ─────────────────────────────────────────
# Each product is assigned a demand/replenishment archetype so the seeded
# history deliberately covers every state the system can classify:
#   staple       — fast mover, reorders monthly, ends comfortably stocked
#   staple_low   — fast mover that ends AT/BELOW its reorder point (urgent)
#   staple_out   — fast mover that ends at zero stock (stockout)
#   watch        — ends slightly above the reorder point (watch band)
#   slow         — long-cycle repeat mover (reorders every ~4-6 months)
#   slow_low     — long-cycle mover that ends low
#   seasonal     — demand bursts only in event months (Jan/May/Jun/Nov/Dec)
#   one_off      — exactly one sale order ever (one-off sourcing)
#   dead         — stocked long ago, zero sales ever (dead stock)
#   new          — first purchased ~25 days ago (short history)
#   fresh        — just-launched SKU: a few recent sales but NO purchase order
#                  ever placed → urgent with empty reorder history (exercises
#                  the dashboard's "No reorder history yet" graph state)
#   oversold     — allocated sales exceed received stock (negative raw stock)
#   backorder    — open customer demand exceeds stock + incoming POs
PROFILE_PARAMS = {
    "staple": {"sale_gap": (10, 20), "po_gap": (26, 42), "cover": (32, 48), "lead": (3, 7), "final": "healthy"},
    "staple_low": {"sale_gap": (10, 20), "po_gap": (28, 44), "cover": (30, 42), "lead": (3, 8), "final": "low"},
    "staple_out": {"sale_gap": (11, 22), "po_gap": (30, 46), "cover": (30, 40), "lead": (4, 9), "final": "out"},
    "watch": {"sale_gap": (12, 22), "po_gap": (30, 46), "cover": (34, 50), "lead": (3, 7), "final": "watch"},
    "slow": {"sale_gap": (55, 100), "po_gap": (110, 170), "cover": (120, 190), "lead": (7, 18), "final": "healthy"},
    "slow_low": {"sale_gap": (50, 95), "po_gap": (120, 180), "cover": (110, 160), "lead": (10, 21), "final": "low"},
    "seasonal": {"sale_gap": (8, 14), "po_gap": (60, 95), "cover": (70, 110), "lead": (4, 10), "final": "watch", "months": {1, 5, 6, 11, 12}},
    "one_off": {"sale_gap": None, "po_gap": None, "cover": None, "lead": (10, 25), "final": "skip"},
    "dead": {"sale_gap": None, "po_gap": None, "cover": None, "lead": (7, 20), "final": "skip"},
    "new": {"sale_gap": (6, 10), "po_gap": (16, 22), "cover": (24, 34), "lead": (2, 5), "final": "healthy", "start_ago": 25},
    "fresh": {"sale_gap": None, "po_gap": None, "cover": None, "lead": (3, 7), "final": "skip"},
    "oversold": {"sale_gap": (12, 22), "po_gap": (42, 60), "cover": (40, 60), "lead": (5, 12), "final": "oversold"},
    "backorder": {"sale_gap": (30, 60), "po_gap": (90, 150), "cover": (100, 150), "lead": (10, 24), "final": "backorder"},
}

# sku -> (profile, per-sale quantity range in BASE units)
SKU_PROFILES = {
    "NB-A5-80-TH": ("staple", 20, 60),
    "PEN-BL-05": ("staple", 50, 150),
    "PEN-BK-05": ("staple", 50, 150),
    "A4-80G-RM": ("staple", 10, 30),
    "STK-NOTE-3X3": ("staple", 12, 36),
    "TISSUE-BOX": ("staple", 24, 96),
    "TAPE-OPP-48": ("staple", 12, 36),
    "FLD-MANILA-A4": ("staple", 50, 200),
    "CUP-PAPER-8OZ": ("staple", 100, 400),
    "MASK-SURGICAL": ("staple", 50, 150),
    "PEN-RD-05": ("staple_low", 20, 60),
    "MKR-WB-BL": ("staple_low", 12, 36),
    "MKR-WB-BK": ("staple_low", 12, 36),
    "LBL-THERM-80": ("staple_low", 12, 48),
    "CRT-TAPE-5M": ("staple_low", 12, 36),
    "PEN-GEL-07": ("fresh", 18, 48),
    "WHITEBOARD-ERASER": ("staple_out", 6, 24),
    "COFFEE-FILTER": ("staple_out", 100, 300),
    "NB-A4-120-TH": ("watch", 10, 30),
    "MAILER-BAG-M": ("watch", 50, 150),
    "GLOVE-NITRILE-M": ("watch", 100, 300),
    "BND-PVC-2IN": ("slow", 6, 24),
    "STP-MINI": ("slow", 4, 12),
    "STP-26-6": ("slow", 10, 30),
    "HLT-SET-4": ("slow", 6, 24),
    "CLEAN-SPRAY": ("slow", 6, 18),
    "USB-C-1M": ("slow", 5, 15),
    "HDMI-2M": ("slow", 3, 10),
    "INK-BLK-001": ("slow", 4, 12),
    "TONER-LJ-85A": ("slow", 1, 4),
    "FLD-CLEAR-A4": ("slow", 25, 100),
    "CLP-BINDER-32": ("slow", 12, 48),
    "TAPE-MASK-24": ("slow", 12, 36),
    "BOX-A4-SHIP": ("slow", 25, 100),
    "PENCIL-2B": ("slow", 50, 150),
    "ENVELOPE-C5": ("slow", 100, 300),
    "BND-PVC-3IN": ("slow_low", 4, 12),
    "INK-MAG-001": ("slow_low", 2, 8),
    "BADGE-LANYARD": ("seasonal", 100, 400),
    "NAMECARD-HOLDER": ("seasonal", 100, 300),
    "WRAP-BUBBLE-50": ("seasonal", 1, 5),
    "VEST-SAFETY": ("seasonal", 5, 20),
    "ADP-USB65W": ("one_off", 10, 20),
    "DRUM-LJ-85A": ("one_off", 2, 4),
    "SIGN-STAND-A4": ("one_off", 8, 12),
    "INK-YEL-001": ("dead", 0, 0),
    "FOAMBOARD-A1": ("dead", 0, 0),
    "USB-C-2M": ("new", 5, 15),
    "LBL-A4-100": ("oversold", 200, 600),
    "A3-80G-RM": ("backorder", 5, 20),
    "INK-CYN-001": ("backorder", 2, 8),
}

# Products that end low/out *with* a replacement PO already on the way, vs.
# urgent ones with no incoming stock at all (the Quick-PO case).
INCOMING_RELIEF_SKUS = {"LBL-THERM-80", "COFFEE-FILTER", "BND-PVC-3IN"}
DELAYED_PO_SKUS = {"INK-CYN-001", "TAPE-MASK-24", "GLOVE-NITRILE-M"}
BACKORDER_SKUS = {"A3-80G-RM", "INK-CYN-001"}


def money(value):
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def decimal(value):
    return Decimal(str(value))


def line_amount(quantity, unit_price, discounts):
    amount = decimal(quantity) * decimal(unit_price)
    for discount in discounts:
        amount *= Decimal("1") - (decimal(discount) / Decimal("100"))
    return money(amount)


def transaction_totals(line_amounts, vat_mode):
    subtotal = sum(line_amounts, Decimal("0.00"))
    if vat_mode == "included":
        total_before_vat = money(subtotal / (Decimal("1") + VAT_RATE))
        vat_amount = money(subtotal - total_before_vat)
        grand_total = money(subtotal)
    elif vat_mode == "none":
        total_before_vat = money(subtotal)
        vat_amount = Decimal("0.00")
        grand_total = money(subtotal)
    else:
        total_before_vat = money(subtotal)
        vat_amount = money(subtotal * VAT_RATE)
        grand_total = money(subtotal + vat_amount)
    return total_before_vat, vat_amount, grand_total


def lead_days(transaction_date, expected_date):
    if not transaction_date or not expected_date:
        return None
    return max(0, (expected_date - transaction_date).days)


def add_business_days(start_date, days):
    current = start_date
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


class Command(BaseCommand):
    help = "Seed a large set of realistic operational inventory records."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._demo_id_counters = {}
        self._reference_counters = {}
        self._sequential_reference_counters = {}

    def add_arguments(self, parser):
        parser.add_argument(
            "--keep-previous-demo",
            action="store_true",
            help="Do not remove records previously created with demo-* identifiers.",
        )
        parser.add_argument(
            "--skip-documents",
            action="store_true",
            help="Do not create transaction document files.",
        )

    def next_demo_id(self, model, prefix):
        key = (model._meta.label_lower, prefix)
        if key not in self._demo_id_counters:
            max_serial = 0
            for value in model.objects.filter(id__startswith=prefix).values_list("id", flat=True):
                suffix = f"{value or ''}"[len(prefix):]
                if suffix.isdigit():
                    max_serial = max(max_serial, int(suffix))
            self._demo_id_counters[key] = max_serial

        self._demo_id_counters[key] += 1
        return f"{prefix}{self._demo_id_counters[key]}"

    def next_reference_no(self, model, prefix, transaction_date=None, sequential=False):
        if sequential:
            key = (model._meta.label_lower, prefix)
            if key not in self._sequential_reference_counters:
                max_serial = 0
                reference_prefix = f"{prefix}-"
                for value in model.objects.filter(
                    reference_no__startswith=reference_prefix
                ).values_list("reference_no", flat=True):
                    suffix = f"{value or ''}"[len(reference_prefix):]
                    if suffix.isdigit() and len(suffix) == 6:
                        max_serial = max(max_serial, int(suffix))
                self._sequential_reference_counters[key] = max_serial

            self._sequential_reference_counters[key] += 1
            return f"{prefix}-{self._sequential_reference_counters[key]:06d}"

        buddhist_year = transaction_date.year + 543
        year_month = f"{str(buddhist_year)[-2:]}{transaction_date.month:02d}"
        reference_prefix = f"{prefix}-{year_month}-"
        key = (model._meta.label_lower, prefix, year_month)

        if key not in self._reference_counters:
            max_serial = 0
            for value in model.objects.filter(
                reference_no__startswith=reference_prefix
            ).values_list("reference_no", flat=True):
                suffix = f"{value or ''}"[len(reference_prefix):]
                if suffix.isdigit():
                    max_serial = max(max_serial, int(suffix))
            self._reference_counters[key] = max_serial

        self._reference_counters[key] += 1
        return f"{reference_prefix}{self._reference_counters[key]:03d}"

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(260429)

        if not options["keep_previous_demo"]:
            self.remove_previous_demo_records()

        categories = self.seed_categories()
        suppliers = self.seed_suppliers()
        customers = self.seed_customers()
        products = self.seed_products(categories)
        po_events, sale_events = self.build_simulation_plan(rng, products, suppliers, customers)
        purchases = self.seed_purchases(rng, suppliers, products, po_events)
        quotations = self.seed_quotations(rng, suppliers, customers, products)
        sales = self.seed_sales(rng, customers, products, suppliers, sale_events)
        self.seed_state_adjustments(rng, suppliers, customers, products, purchases, sales)
        self.seed_sale_allocations(sales)
        self.link_quotation_documents(rng, quotations, purchases, sales)
        billing_notes = self.seed_billing_notes(rng, sales)
        payment_batches = self.seed_payment_batches(rng, purchases)
        credit_notes = self.seed_credit_notes(rng, sales, billing_notes)

        if not options["skip_documents"]:
            self.seed_documents(rng, purchases, sales)

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded operational data: "
                f"{len(categories)} categories, {len(suppliers)} suppliers, "
                f"{len(customers)} customers, {len(products)} products, "
                f"{len(purchases)} purchases, {len(quotations)} quotations, "
                f"{len(sales)} sales, "
                f"{len(billing_notes)} billing notes, "
                f"{len(payment_batches)} payment batches, "
                f"{len(credit_notes)} credit notes."
            )
        )

    def remove_previous_demo_records(self):
        # Credit notes PROTECT their source sale, so clear them before any sale delete.
        CreditNote.objects.filter(id__startswith="demo-cn-").delete()
        BillingNote.objects.filter(id__startswith="demo-bn-").delete()
        PaymentBatch.objects.filter(id__startswith="demo-pmt-").delete()
        Quotation.objects.filter(id__startswith="demo-qt-").delete()
        for document in PurchaseDocument.objects.filter(purchase__id__startswith="demo-po-"):
            document.file.delete(save=False)
            document.delete()
        for document in SaleDocument.objects.filter(sale__id__startswith="demo-sale-"):
            document.file.delete(save=False)
            document.delete()
        # FIFO allocations PROTECT their purchase items, so clear them (via the
        # sales cascade plus any stragglers) before deleting the purchases.
        SaleItemAllocation.objects.filter(
            purchase_item__purchase__id__startswith="demo-po-"
        ).delete()
        Sale.objects.filter(id__startswith="demo-sale-").delete()
        Purchase.objects.filter(id__startswith="demo-po-").delete()
        Product.objects.filter(id__startswith="demo-").delete()
        Supplier.objects.filter(id__startswith="demo-").delete()
        Customer.objects.filter(id__startswith="demo-").delete()
        Category.objects.filter(id__startswith="demo-").update(parent=None)
        Category.objects.filter(id__startswith="demo-").delete()

    def seed_categories(self):
        specs = [
            ("Operations Inventory", "All stock tracked for internal operations.", None),
            ("Office Supplies", "Core replenishment goods used across departments.", "Operations Inventory"),
            ("Paper Goods", "Paper, forms, notebooks, labels, and rolls.", "Office Supplies"),
            ("Writing Tools", "Pens, markers, highlighters, correction supplies.", "Office Supplies"),
            ("Filing & Binding", "Folders, binders, clips, and archive supplies.", "Office Supplies"),
            ("Packaging", "Tape, cartons, mailers, labels, and wrap.", "Operations Inventory"),
            ("Electronics", "Small electronics and cable accessories.", "Operations Inventory"),
            ("Cleaning & Pantry", "Consumables for pantry and common areas.", "Operations Inventory"),
            ("Safety Stock", "Safety and facility consumables.", "Operations Inventory"),
            ("Event Materials", "Supplies commonly used for events and training.", "Operations Inventory"),
            ("Writing Instruments", "Pens, pencils, and everyday writing tools.", "Writing Tools"),
            ("Pens", "Ballpoint and gel pens by ink color.", "Writing Instruments"),
            ("Blue Pens", "Blue ink pens for daily issue.", "Pens"),
            ("Black Pens", "Black ink pens for daily issue.", "Pens"),
            ("Red Pens", "Red ink pens for corrections and marking.", "Pens"),
            ("Gel Pens", "Gel ink pens, assorted colors.", "Pens"),
            ("Pencils", "Graphite pencils and related writing tools.", "Writing Instruments"),
            ("Presentation Markers", "Markers and erasers for training rooms.", "Writing Tools"),
            ("Whiteboard Markers", "Colored whiteboard markers.", "Presentation Markers"),
            ("Whiteboard Accessories", "Erasers and accessories for boards.", "Presentation Markers"),
            ("Correction Supplies", "Correction tape and related consumables.", "Writing Tools"),
            ("Notebooks", "Bound notebooks by paper size.", "Paper Goods"),
            ("A5 Notebooks", "A5 notebook stock.", "Notebooks"),
            ("A4 Notebooks", "A4 notebook stock.", "Notebooks"),
            ("Copy Paper", "Copy paper by size and weight.", "Paper Goods"),
            ("A4 Copy Paper", "A4 ream and carton paper.", "Copy Paper"),
            ("A3 Copy Paper", "A3 ream and carton paper.", "Copy Paper"),
            ("Adhesive Notes", "Sticky notes and reminder pads.", "Paper Goods"),
            ("Labels", "Address and thermal labels.", "Paper Goods"),
            ("Thermal Labels", "Roll labels for barcode and dispatch printers.", "Labels"),
            ("Sheet Labels", "A4 sheet labels for addresses.", "Labels"),
            ("Envelopes", "Mailing envelopes by size.", "Paper Goods"),
            ("Folders", "Folders and file covers.", "Filing & Binding"),
            ("Manila Folders", "Manila paper folders.", "Folders"),
            ("Clear Folders", "Plastic clear folders.", "Folders"),
            ("Binders", "Ring binders by spine size.", "Filing & Binding"),
            ("Two Inch Binders", "2 inch binder stock.", "Binders"),
            ("Three Inch Binders", "3 inch binder stock.", "Binders"),
            ("Clips & Fasteners", "Clips, staples, and fastening tools.", "Filing & Binding"),
            ("Binder Clips", "Binder clips by size.", "Clips & Fasteners"),
            ("Staplers", "Staplers and stapling tools.", "Clips & Fasteners"),
            ("Staples", "Staple refill boxes.", "Clips & Fasteners"),
            ("Tapes", "Packing and masking tapes.", "Packaging"),
            ("Packing Tapes", "OPP tape for cartons.", "Tapes"),
            ("Masking Tapes", "Masking tape for events and labeling.", "Tapes"),
            ("Shipping Containers", "Boxes and mailers.", "Packaging"),
            ("Shipping Boxes", "Shipping carton and box stock.", "Shipping Containers"),
            ("Mailer Bags", "Plastic and paper mailers.", "Shipping Containers"),
            ("Protective Packaging", "Wraps and cushioning materials.", "Packaging"),
            ("Bubble Wrap", "Bubble wrap rolls and meter-based stock.", "Protective Packaging"),
            ("Cables", "Data and charging cables.", "Electronics"),
            ("USB-C Cables", "USB-C cable stock by length.", "Cables"),
            ("HDMI Cables", "HDMI cable stock by length.", "Cables"),
            ("Power Accessories", "Power adapters and charging accessories.", "Electronics"),
            ("USB-C Adapters", "USB-C power adapters.", "Power Accessories"),
            ("Printer Supplies", "Ink, toner, maintenance parts, and paper feed supplies.", "Electronics"),
            ("Ink Supplies", "Ink bottles by color.", "Printer Supplies"),
            ("Black Ink", "Black ink bottles.", "Ink Supplies"),
            ("Color Ink", "Cyan, magenta, and yellow ink bottles.", "Ink Supplies"),
            ("Toner Supplies", "Laser toner and drum units.", "Printer Supplies"),
            ("Laser Toner", "Laser toner cartridges.", "Toner Supplies"),
            ("Printer Drums", "Printer drum units.", "Toner Supplies"),
            ("Cleaning Chemicals", "Cleaning sprays and liquids.", "Cleaning & Pantry"),
            ("Surface Cleaners", "Surface cleaning consumables.", "Cleaning Chemicals"),
            ("Pantry Consumables", "Pantry and break-room stock.", "Cleaning & Pantry"),
            ("Tissue Products", "Tissue boxes and paper products.", "Pantry Consumables"),
            ("Drinkware", "Disposable cups and drinkware.", "Pantry Consumables"),
            ("Coffee Supplies", "Coffee filters and supporting consumables.", "Pantry Consumables"),
            ("PPE", "Personal protective equipment.", "Safety Stock"),
            ("Gloves", "Disposable glove stock.", "PPE"),
            ("Masks", "Surgical and disposable masks.", "PPE"),
            ("Visibility Gear", "Safety vests and visibility items.", "Safety Stock"),
            ("Event Identification", "Badges, holders, and lanyards.", "Event Materials"),
            ("Lanyards", "Event badge lanyards.", "Event Identification"),
            ("Badge Holders", "Name card and badge holders.", "Event Identification"),
            ("Event Signage", "Sign boards and stands.", "Event Materials"),
            ("Display Boards", "Foam boards and display materials.", "Event Signage"),
            ("Sign Stands", "Reusable sign stands.", "Event Signage"),
        ]
        categories = {}
        for name, description, parent_name in specs:
            parent = categories.get(parent_name) if parent_name else None
            category = Category.objects.filter(name=name).first()
            defaults = {"description": description, "parent": parent}
            if category:
                for field, value in defaults.items():
                    setattr(category, field, value)
                category.save()
            else:
                category = Category.objects.create(name=name, **defaults)
            categories[name] = category
        return categories

    def seed_suppliers(self):
        specs = [
            ("Bangkok Office Supply Co., Ltd.", "0105567001181", "Bang Rak, Bangkok", "orders@bangkokoffice.co.th", "02-118-2400", "Head Office", "Net 30, accepts partial deliveries.", "Nattapong Srisai", "02-118-2415"),
            ("Siam Paper & Label Ltd.", "0105567002292", "Khlong Toei, Bangkok", "sales@siampaperlabel.co.th", "02-229-1400", "Head Office", "Paper goods, VAT included invoice options.", "Mayuree Tan", "02-229-1422"),
            ("Eastern Stationery Wholesale", "0205567003303", "Mueang Chonburi", "wholesale@easternstationery.co.th", "038-330-220", "Chonburi", "Large carton orders.", "Kritsada Boonmee", "038-330-245"),
            ("Metro Packaging Hub", "0115567004414", "Bang Phli, Samut Prakan", "care@metropack.co.th", "02-441-8800", "Samut Prakan", "Packaging and no-VAT cash receipt cases.", "Siriporn Wattanakul", "02-441-8828"),
            ("Thai Tech Accessories", "0105567005525", "Huai Khwang, Bangkok", "b2b@thaitechaccessories.co.th", "02-552-0101", "Ratchada", "Requires prepayment for cables.", "Anucha Rerkchai", "02-552-0139"),
            ("North Star Printing Supply", "0505567006636", "Mueang Chiang Mai", "orders@northstarprinting.co.th", "053-663-777", "Chiang Mai", "Printer ink and maintenance supplies.", "Pimchanok Saelim", "053-663-781"),
            ("Central Facilities Mart", "0105567007747", "Chatuchak, Bangkok", "supply@centralfacilities.co.th", "02-774-5151", "Chatuchak", "Pantry and cleaning supplies.", "Thanawat Ruangdej", "02-774-5170"),
            ("Smart Label Solutions", "0105567008858", "Lat Krabang, Bangkok", "team@smartlabel.co.th", "02-885-6400", "Lat Krabang", "Thermal labels and barcode supplies.", "Kamonchanok Kiatkul", "02-885-6418"),
            ("Apex Filing Systems", "0105567009969", "Pathum Wan, Bangkok", "sales@apexfiling.co.th", "02-996-4120", "Pathum Wan", "Folders, binders, and archive boxes.", "Phuriwat Techakul", "02-996-4146"),
            ("Green Office Products", "0105567011070", "Nonthaburi", "service@greenoffice.co.th", "02-107-3000", "Nonthaburi", "Eco-friendly office supplies.", "Supansa Kongsuk", "02-107-3024"),
            ("Rapid Event Supply", "0105567012181", "Din Daeng, Bangkok", "events@rapidsupply.co.th", "02-218-9060", "Din Daeng", "Rush orders for event materials.", "Warit Chansiri", "02-218-9088"),
            ("Union Safety & Facility", "0105567013292", "Khlong Sam Wa, Bangkok", "orders@unionsafety.co.th", "02-329-4444", "Khlong Sam Wa", "Safety and facility consumables.", "Kanyarat Pholsa", "02-329-4462"),
            ("Premier Toner House", "0105567014303", "Phaya Thai, Bangkok", "billing@premiertoner.co.th", "02-430-9000", "Phaya Thai", "Toner, ink, and printer accessories.", "Rapeepat Jitjaroen", "02-430-9027"),
            ("Bright Desk Essentials", "0105567015414", "Mueang Pathum Thani", "hello@brightdesk.co.th", "02-541-2112", "Pathum Thani", "Small desk supplies.", "Thidarat Nimitdee", "02-541-2140"),
            ("Warehouse Direct Thailand", "0105567016525", "Bang Yai, Nonthaburi", "wd@warehousedirect.co.th", "02-652-8787", "Bang Yai", "Bulk stock with frequent backorders.", "Nirun Petchsawat", "02-652-8815"),
        ]
        suppliers = []
        for idx, (
            name,
            taxpayer_id,
            location,
            email,
            tel,
            branch,
            remark,
            procurement_name,
            procurement_tel,
        ) in enumerate(specs):
            supplier = Supplier.objects.filter(company_name=name).first()
            defaults = {
                "company_name": name,
                "procurement_name": procurement_name,
                "procurement_tel": procurement_tel,
                "locations": [f"{idx + 10} {location}", f"Warehouse {idx + 1}, {location}"],
                "selected_location_index": 0,
                "emails": [email, f"accounting+{idx + 1}@supplier-mail.co.th"],
                "selected_email_index": 0,
                "tels": [tel],
                "selected_tel_index": 0,
                "taxpayer_id": taxpayer_id,
                "branches": [branch, "Distribution Center"],
                "selected_branch_index": 0,
                "shipping_addresses": [f"Receiving dock, {location}"],
                "selected_shipping_address_index": 0,
                "remark": remark,
                "term_type": ["credit", "cash", "credit", "credit"][idx % 4],
                "billing_note_date": ["30 days", "", "60 days", "90 days"][idx % 4],
            }
            if supplier:
                for field, value in defaults.items():
                    setattr(supplier, field, value)
                supplier.save()
            else:
                supplier = Supplier.objects.create(**defaults)
            suppliers.append(supplier)
        return suppliers

    def seed_customers(self):
        specs = [
            ("Faculty of Engineering", "0994000001181", "Engineering Building", "engineering.procurement@example.ac.th", "02-300-1100", "Main Campus", "Usually receives same day after packing."),
            ("Central Library Office", "0994000002292", "Library Building", "library.office@example.ac.th", "02-300-2200", "Main Library", "Requests delivery note before payment."),
            ("Admissions Office", "0994000003303", "Administration Building", "admissions.ops@example.ac.th", "02-300-3300", "Main Campus", "Seasonal demand spike before open house."),
            ("Student Council", "", "Student Activity Center", "studentcouncil@example.ac.th", "02-300-4400", "Activity Center", "Event orders can change quickly."),
            ("Faculty of Architecture", "0994000004414", "Architecture Studio", "arch.admin@example.ac.th", "02-300-5500", "North Campus", "High paper and marker usage."),
            ("Research Administration", "0994000005525", "Research Office", "research.admin@example.ac.th", "02-300-6600", "Main Campus", "Pays later after billing approval."),
            ("Human Resources Department", "0994000006636", "HR Office", "hr.office@example.ac.th", "02-300-7700", "Main Campus", "Monthly recurring stationery order."),
            ("Finance Department", "0994000007747", "Finance Office", "finance.procurement@example.ac.th", "02-300-8800", "Main Campus", "Requires tax invoice attachments."),
            ("IT Service Center", "0994000008858", "IT Building", "it.service@example.ac.th", "02-300-9900", "Main Campus", "Cable and label roll orders."),
            ("Training Center", "0994000009969", "Training Hall", "training.center@example.ac.th", "02-301-1000", "East Campus", "Bulk event materials."),
            ("Alumni Relations", "0994000011070", "Alumni Office", "alumni.office@example.ac.th", "02-301-2100", "Main Campus", "Often cancels event orders."),
            ("Procurement Test Branch", "0994000012181", "Procurement Office", "procurement.branch@example.ac.th", "02-301-3200", "Branch Office", "Branch shipping address scenario."),
            ("Medical Faculty Office", "0994000013292", "Medical Faculty", "medical.office@example.ac.th", "02-301-4300", "Hospital Campus", "Safety and facility supplies."),
            ("Graduate School", "0994000014303", "Graduate Building", "graduate.school@example.ac.th", "02-301-5400", "Main Campus", "Mixed delivery statuses."),
            ("International Affairs", "0994000015414", "International Center", "intl.affairs@example.ac.th", "02-301-6500", "Main Campus", "Small frequent urgent orders."),
            ("Facilities Management", "0994000016525", "Facilities Office", "facilities@example.ac.th", "02-301-7600", "Service Campus", "Cleaning and safety items."),
            ("Continuing Education", "0994000017636", "Continuing Education Center", "continuing.edu@example.ac.th", "02-301-8700", "West Campus", "Training kits and event supplies."),
            ("Campus Bookstore", "0994000018747", "Bookstore", "bookstore.orders@example.ac.th", "02-301-9800", "Retail Zone", "Resells stationery items."),
        ]
        customers = []
        for idx, (name, taxpayer_id, location, email, tel, branch, remark) in enumerate(specs):
            customer = Customer.objects.filter(company_name=name).first()
            defaults = {
                "company_name": name,
                "locations": [f"{location}, Bangkok", f"Mail room {idx + 1}, Bangkok"],
                "selected_location_index": 0,
                "emails": [email],
                "selected_email_index": 0,
                "tels": [tel],
                "selected_tel_index": 0,
                "taxpayer_id": taxpayer_id,
                "branches": [branch],
                "selected_branch_index": 0,
                "shipping_addresses": [f"{location} receiving counter", f"{location} storage room"],
                "selected_shipping_address_index": idx % 2,
                "remark": remark,
                "term_type": ["cash", "credit", "credit", "credit"][idx % 4],
                "billing_note_date": ["", "30 days", "60 days", "90 days"][idx % 4],
            }
            if customer:
                for field, value in defaults.items():
                    setattr(customer, field, value)
                customer.save()
            else:
                customer = Customer.objects.create(**defaults)
            customers.append(customer)
        return customers

    def seed_products(self, categories):
        product_specs = [
            ("NB-A5-80-TH", "Notebook A5 80 Sheets", "Paper Goods", "pcs", "carton", "pcs", 90, 18, 29, [("carton", 120, True, False), ("pack", 10, True, True)]),
            ("NB-A4-120-TH", "Notebook A4 120 Sheets", "Paper Goods", "pcs", "carton", "pcs", 45, 34, 55, [("carton", 60, True, False), ("pack", 5, True, True)]),
            ("PEN-BL-05", "Blue Ballpoint Pen 0.5mm", "Writing Tools", "pcs", "box", "pcs", 150, 5.8, 10, [("box", 50, True, True)]),
            ("PEN-BK-05", "Black Ballpoint Pen 0.5mm", "Writing Tools", "pcs", "box", "pcs", 150, 5.8, 10, [("box", 50, True, True)]),
            ("PEN-RD-05", "Red Ballpoint Pen 0.5mm", "Writing Tools", "pcs", "box", "pcs", 60, 6.2, 11, [("box", 50, True, True)]),
            ("MKR-WB-BL", "Whiteboard Marker Blue", "Writing Tools", "pcs", "box", "pcs", 50, 14, 25, [("box", 12, True, True)]),
            ("MKR-WB-BK", "Whiteboard Marker Black", "Writing Tools", "pcs", "box", "pcs", 50, 14, 25, [("box", 12, True, True)]),
            ("HLT-SET-4", "Highlighter Set 4 Colors", "Writing Tools", "set", "carton", "set", 35, 38, 65, [("carton", 48, True, False)]),
            ("CRT-TAPE-5M", "Correction Tape 5m", "Writing Tools", "pcs", "box", "pcs", 40, 18, 29, [("box", 24, True, True)]),
            ("PEN-GEL-07", "Gel Pen 0.7mm Assorted", "Writing Tools", "pcs", "box", "pcs", 60, 6.5, 13, [("box", 12, True, True)]),
            ("STK-NOTE-3X3", "Sticky Notes 3x3", "Paper Goods", "pad", "pack", "pad", 70, 16, 28, [("pack", 12, True, True)]),
            ("A4-80G-RM", "A4 Copy Paper 80gsm", "Paper Goods", "ream", "carton", "ream", 65, 108, 145, [("carton", 5, True, True)]),
            ("A3-80G-RM", "A3 Copy Paper 80gsm", "Paper Goods", "ream", "carton", "ream", 20, 220, 295, [("carton", 5, True, True)]),
            ("LBL-THERM-80", "Thermal Label Roll 80mm", "Paper Goods", "roll", "case", "roll", 45, 42, 70, [("case", 24, True, True)]),
            ("LBL-A4-100", "A4 Address Label Sheet", "Paper Goods", "sheet", "pack", "pack", 30, 2.1, 260, [("pack", 100, True, True)]),
            ("FLD-MANILA-A4", "Manila Folder A4", "Filing & Binding", "pcs", "pack", "pcs", 120, 4.2, 8, [("pack", 100, True, True)]),
            ("FLD-CLEAR-A4", "Clear File Folder A4", "Filing & Binding", "pcs", "pack", "pcs", 100, 5.1, 9, [("pack", 50, True, True)]),
            ("BND-PVC-2IN", "PVC Binder 2 Inch", "Filing & Binding", "pcs", "carton", "pcs", 35, 68, 118, [("carton", 24, True, False)]),
            ("BND-PVC-3IN", "PVC Binder 3 Inch", "Filing & Binding", "pcs", "carton", "pcs", 25, 82, 135, [("carton", 18, True, False)]),
            ("CLP-BINDER-32", "Binder Clip 32mm", "Filing & Binding", "pcs", "box", "box", 30, 1.7, 55, [("box", 12, True, True)]),
            ("STP-MINI", "Mini Stapler", "Filing & Binding", "pcs", "carton", "pcs", 18, 48, 79, [("carton", 24, True, False)]),
            ("STP-26-6", "Staples 26/6", "Filing & Binding", "box", "carton", "box", 50, 9, 18, [("carton", 60, True, False)]),
            ("TAPE-OPP-48", "OPP Packing Tape 48mm", "Packaging", "roll", "carton", "roll", 80, 24, 39, [("carton", 36, True, True)]),
            ("TAPE-MASK-24", "Masking Tape 24mm", "Packaging", "roll", "carton", "roll", 40, 18, 32, [("carton", 48, True, True)]),
            ("BOX-A4-SHIP", "A4 Shipping Box", "Packaging", "pcs", "bundle", "pcs", 60, 11, 19, [("bundle", 50, True, False)]),
            ("MAILER-BAG-M", "Mailer Bag Medium", "Packaging", "pcs", "pack", "pcs", 80, 3.8, 7, [("pack", 100, True, True)]),
            ("WRAP-BUBBLE-50", "Bubble Wrap Roll 50m", "Packaging", "roll", "roll", "meter", 5, 310, 9, [("meter", 0.02, False, True)]),
            ("USB-C-1M", "USB-C Cable 1m", "Electronics", "pcs", "pack", "pcs", 25, 72, 125, [("pack", 10, True, True)]),
            ("USB-C-2M", "USB-C Cable 2m", "Electronics", "pcs", "pack", "pcs", 20, 98, 165, [("pack", 10, True, True)]),
            ("HDMI-2M", "HDMI Cable 2m", "Electronics", "pcs", "pack", "pcs", 15, 115, 190, [("pack", 5, True, True)]),
            ("ADP-USB65W", "USB-C Power Adapter 65W", "Electronics", "pcs", "carton", "pcs", 10, 420, 690, [("carton", 20, True, False)]),
            ("INK-BLK-001", "Black Printer Ink Bottle", "Printer Supplies", "bottle", "case", "bottle", 24, 145, 225, [("case", 12, True, False)]),
            ("INK-CYN-001", "Cyan Printer Ink Bottle", "Printer Supplies", "bottle", "case", "bottle", 12, 152, 235, [("case", 12, True, False)]),
            ("INK-MAG-001", "Magenta Printer Ink Bottle", "Printer Supplies", "bottle", "case", "bottle", 12, 152, 235, [("case", 12, True, False)]),
            ("INK-YEL-001", "Yellow Printer Ink Bottle", "Printer Supplies", "bottle", "case", "bottle", 12, 152, 235, [("case", 12, True, False)]),
            ("TONER-LJ-85A", "Laser Toner 85A", "Printer Supplies", "cartridge", "carton", "cartridge", 8, 1280, 1890, [("carton", 6, True, False)]),
            ("DRUM-LJ-85A", "Printer Drum Unit 85A", "Printer Supplies", "unit", "carton", "unit", 4, 1650, 2450, [("carton", 4, True, False)]),
            ("CLEAN-SPRAY", "Surface Cleaning Spray", "Cleaning & Pantry", "bottle", "case", "bottle", 30, 52, 85, [("case", 12, True, False)]),
            ("TISSUE-BOX", "Facial Tissue Box", "Cleaning & Pantry", "box", "carton", "box", 80, 16, 28, [("carton", 48, True, True)]),
            ("CUP-PAPER-8OZ", "Paper Cup 8oz", "Cleaning & Pantry", "pcs", "pack", "pack", 40, 0.85, 110, [("pack", 100, True, True)]),
            ("COFFEE-FILTER", "Coffee Filter Paper", "Cleaning & Pantry", "pcs", "pack", "pack", 20, 0.55, 85, [("pack", 100, True, True)]),
            ("GLOVE-NITRILE-M", "Nitrile Glove Medium", "Safety Stock", "pcs", "box", "box", 15, 2.2, 285, [("box", 100, True, True)]),
            ("MASK-SURGICAL", "Surgical Mask", "Safety Stock", "pcs", "box", "box", 30, 0.75, 95, [("box", 50, True, True)]),
            ("VEST-SAFETY", "Reflective Safety Vest", "Safety Stock", "pcs", "carton", "pcs", 10, 92, 155, [("carton", 30, True, False)]),
            ("BADGE-LANYARD", "Event Badge Lanyard", "Event Materials", "pcs", "pack", "pcs", 150, 6.5, 12, [("pack", 100, True, True)]),
            ("NAMECARD-HOLDER", "Name Card Holder", "Event Materials", "pcs", "pack", "pcs", 120, 4.8, 10, [("pack", 100, True, True)]),
            ("FOAMBOARD-A1", "Foam Board A1", "Event Materials", "sheet", "pack", "sheet", 20, 88, 140, [("pack", 10, True, False)]),
            ("SIGN-STAND-A4", "A4 Sign Stand", "Event Materials", "pcs", "carton", "pcs", 12, 155, 240, [("carton", 12, True, False)]),
            ("WHITEBOARD-ERASER", "Whiteboard Eraser", "Writing Tools", "pcs", "box", "pcs", 25, 22, 39, [("box", 24, True, True)]),
            ("PENCIL-2B", "Pencil 2B", "Writing Tools", "pcs", "box", "pcs", 100, 3.6, 7, [("box", 50, True, True)]),
            ("ENVELOPE-C5", "C5 Envelope", "Paper Goods", "pcs", "pack", "pack", 50, 1.6, 95, [("pack", 100, True, True)]),
        ]
        category_overrides = {
            "NB-A5-80-TH": "A5 Notebooks",
            "NB-A4-120-TH": "A4 Notebooks",
            "PEN-BL-05": "Blue Pens",
            "PEN-BK-05": "Black Pens",
            "PEN-RD-05": "Red Pens",
            "MKR-WB-BL": "Whiteboard Markers",
            "MKR-WB-BK": "Whiteboard Markers",
            "HLT-SET-4": "Presentation Markers",
            "CRT-TAPE-5M": "Correction Supplies",
            "PEN-GEL-07": "Gel Pens",
            "STK-NOTE-3X3": "Adhesive Notes",
            "A4-80G-RM": "A4 Copy Paper",
            "A3-80G-RM": "A3 Copy Paper",
            "LBL-THERM-80": "Thermal Labels",
            "LBL-A4-100": "Sheet Labels",
            "FLD-MANILA-A4": "Manila Folders",
            "FLD-CLEAR-A4": "Clear Folders",
            "BND-PVC-2IN": "Two Inch Binders",
            "BND-PVC-3IN": "Three Inch Binders",
            "CLP-BINDER-32": "Binder Clips",
            "STP-MINI": "Staplers",
            "STP-26-6": "Staples",
            "TAPE-OPP-48": "Packing Tapes",
            "TAPE-MASK-24": "Masking Tapes",
            "BOX-A4-SHIP": "Shipping Boxes",
            "MAILER-BAG-M": "Mailer Bags",
            "WRAP-BUBBLE-50": "Bubble Wrap",
            "USB-C-1M": "USB-C Cables",
            "USB-C-2M": "USB-C Cables",
            "HDMI-2M": "HDMI Cables",
            "ADP-USB65W": "USB-C Adapters",
            "INK-BLK-001": "Black Ink",
            "INK-CYN-001": "Color Ink",
            "INK-MAG-001": "Color Ink",
            "INK-YEL-001": "Color Ink",
            "TONER-LJ-85A": "Laser Toner",
            "DRUM-LJ-85A": "Printer Drums",
            "CLEAN-SPRAY": "Surface Cleaners",
            "TISSUE-BOX": "Tissue Products",
            "CUP-PAPER-8OZ": "Drinkware",
            "COFFEE-FILTER": "Coffee Supplies",
            "GLOVE-NITRILE-M": "Gloves",
            "MASK-SURGICAL": "Masks",
            "VEST-SAFETY": "Visibility Gear",
            "BADGE-LANYARD": "Lanyards",
            "NAMECARD-HOLDER": "Badge Holders",
            "FOAMBOARD-A1": "Display Boards",
            "SIGN-STAND-A4": "Sign Stands",
            "WHITEBOARD-ERASER": "Whiteboard Accessories",
            "PENCIL-2B": "Pencils",
            "ENVELOPE-C5": "Envelopes",
        }
        # A couple of retired products so the "inactive / disabled product"
        # case is visible in the products directory and lookups.
        inactive_skus = {"SIGN-STAND-A4", "FOAMBOARD-A1"}
        products = []
        for display_id, spec in enumerate(product_specs, start=1001):
            sku, name, category_name, base_unit, purchase_unit, sales_unit, reorder, cost, price, conversions = spec
            category_name = category_overrides.get(sku, category_name)
            category = categories[category_name]
            product, _ = Product.objects.update_or_create(
                sku=sku,
                defaults={
                    "product_display_id": display_id,
                    "previous_skus": [f"{sku}-OLD"] if display_id % 5 == 0 else [],
                    "product_name": name,
                    "sub_names": [name.lower(), sku.lower()],
                    "stock_base_unit": base_unit,
                    "default_purchase_unit": purchase_unit,
                    "default_sales_unit": sales_unit,
                    "category": category,
                    "category_name": category.name,
                    "detail": f"{name} used for purchasing, stock, sales, and reporting workflows.",
                    "reorder_level": decimal(reorder),
                    "is_active": sku not in inactive_skus,
                },
            )
            ProductUnitConversion.objects.filter(product=product).delete()
            ProductUnitConversion.objects.create(
                product=product,
                unit=base_unit,
                factor_to_base=Decimal("1"),
                allow_purchase=True,
                allow_sale=True,
            )
            for unit, factor, allow_purchase, allow_sale in conversions:
                ProductUnitConversion.objects.create(
                    product=product,
                    unit=unit,
                    factor_to_base=decimal(factor),
                    allow_purchase=allow_purchase,
                    allow_sale=allow_sale,
                )
            product._seed_cost = Decimal(str(cost))
            product._seed_price = Decimal(str(price))
            products.append(product)
        return products

    def choose_unit(self, rng, product, for_purchase):
        conversions = list(product.unit_conversions.all())
        allowed = [
            conversion
            for conversion in conversions
            if (conversion.allow_purchase if for_purchase else conversion.allow_sale)
        ]
        preferred_unit = product.default_purchase_unit if for_purchase else product.default_sales_unit
        preferred = next((conversion for conversion in allowed if conversion.unit == preferred_unit), None)
        if preferred and rng.random() < 0.55:
            return preferred
        return rng.choice(allowed or conversions)

    def discounts(self, rng, allow_multiple=True):
        roll = rng.random()
        if roll < 0.50:
            return []
        if roll < 0.78:
            return [rng.choice([2, 3, 5, 7, 10, 12])]
        if allow_multiple:
            return [rng.choice([3, 5, 8]), rng.choice([2, 4, 5])]
        return [rng.choice([5, 10])]

    # ── Two-year demand/replenishment simulation ─────────────────────────
    def product_profile(self, product):
        profile_name, qty_lo, qty_hi = SKU_PROFILES.get(
            product.sku, ("slow", 5, 20)
        )
        return profile_name, PROFILE_PARAMS[profile_name], qty_lo, qty_hi

    def cost_drift(self, rng, day_offset):
        """Unit costs rise ~13% across the seeded history (older FIFO layers are
        cheaper), with per-order noise so supplier best/last costs differ."""
        progress = day_offset / HISTORY_DAYS
        return decimal(0.88 + 0.13 * progress + rng.uniform(-0.03, 0.03))

    def build_simulation_plan(self, rng, products, suppliers, customers):
        """Walk each product through a three-year timeline of replenishment
        receipts and demand events according to its archetype. Returns flat
        event lists; document bucketing happens in seed_purchases/seed_sales."""
        today = timezone.localdate()
        sim_start = today - timedelta(days=HISTORY_DAYS)
        po_events = []
        sale_events = []

        # Regular departments per product (2-4 repeat buyers each).
        def product_customers(idx):
            return [customers[(idx * 5 + k) % len(customers)] for k in range(2 + idx % 3)]

        # 2-3 alternating suppliers per product, primary first.
        def product_suppliers(idx):
            return [suppliers[(idx * 3 + k) % len(suppliers)] for k in range(2 + idx % 2)]

        for idx, product in enumerate(products):
            profile_name, params, qty_lo, qty_hi = self.product_profile(product)
            sources = product_suppliers(idx)
            buyers = product_customers(idx)
            mean_qty = (qty_lo + qty_hi) / 2 or 1

            if profile_name == "dead":
                # Stocked twice long ago (1.5–2.8 yrs back), never sold.
                for ago in (rng.randint(840, 1010), rng.randint(560, 700)):
                    receipt_date = today - timedelta(days=ago)
                    po_events.append(self.plan_po_event(
                        rng, product, sources, receipt_date, today,
                        qty_base=rng.randint(20, 60), lead=params["lead"],
                    ))
                continue

            if profile_name == "fresh":
                # Just-launched SKU: a handful of recent sale orders, but
                # procurement has NOT placed a single PO yet → ends oversold and
                # urgent with an empty reorder history (the dashboard graph shows
                # "No reorder history yet" + an Order-now recommendation).
                cursor = today - timedelta(days=rng.randint(28, 40))
                while cursor <= today - timedelta(days=1):
                    sale_events.append({
                        "product": product,
                        "customer": rng.choice(buyers),
                        "date": cursor,
                        "qty_base": rng.randint(qty_lo, qty_hi),
                    })
                    cursor += timedelta(days=rng.randint(6, 11))
                continue

            if profile_name == "one_off":
                # One purchase, one sale order ever — one-off sourcing.
                receipt_ago = rng.randint(380, 460)
                receipt_date = today - timedelta(days=receipt_ago)
                order_qty = rng.randint(max(1, qty_lo), max(2, qty_hi)) * 2
                po_events.append(self.plan_po_event(
                    rng, product, sources, receipt_date, today,
                    qty_base=order_qty, lead=params["lead"],
                ))
                sale_events.append({
                    "product": product,
                    "customer": rng.choice(buyers),
                    "date": receipt_date + timedelta(days=rng.randint(5, 20)),
                    "qty_base": max(1, int(order_qty * rng.uniform(0.55, 0.8))),
                })
                continue

            sale_gap = params["sale_gap"]
            po_gap = params["po_gap"]
            cover = params["cover"]
            months = params.get("months")
            start_ago = params.get("start_ago")
            first_day = (
                today - timedelta(days=start_ago)
                if start_ago
                else sim_start + timedelta(days=rng.randint(0, 25))
            )
            daily_est = mean_qty / ((sale_gap[0] + sale_gap[1]) / 2)

            # Replenishment receipts at the product's cadence.
            stock = 0
            cursor = first_day
            receipts = []
            while cursor <= today - timedelta(days=2):
                qty = max(1, int(daily_est * rng.uniform(*cover)))
                receipts.append((cursor, qty))
                cursor += timedelta(days=rng.randint(*po_gap))
            for receipt_date, qty in receipts:
                po_events.append(self.plan_po_event(
                    rng, product, sources, receipt_date, today,
                    qty_base=qty, lead=params["lead"],
                ))

            # Demand events, stock-aware (the oversold archetype is pushed
            # past its stock later, in seed_state_adjustments).
            receipt_iter = iter(receipts)
            next_receipt = next(receipt_iter, None)
            cursor = first_day + timedelta(days=rng.randint(2, 6))
            while cursor <= today:
                while next_receipt and next_receipt[0] <= cursor:
                    stock += next_receipt[1]
                    next_receipt = next(receipt_iter, None)
                if months and cursor.month not in months:
                    cursor += timedelta(days=7)
                    continue
                qty = rng.randint(qty_lo, qty_hi)
                qty = min(qty, stock)
                if qty >= max(1, qty_lo // 2):
                    stock -= qty
                    sale_events.append({
                        "product": product,
                        "customer": rng.choice(buyers),
                        "date": cursor,
                        "qty_base": qty,
                    })
                cursor += timedelta(days=rng.randint(*sale_gap))

        # HR's monthly stationery basket: a recurring multi-line order on the
        # 1st-3rd of every month (matches the customer's remark, and guarantees
        # multi-line sales so partial pack/ship statuses have data).
        hr = next((c for c in customers if "Human Resources" in c.company_name), customers[0])
        staples = [p for p in products if SKU_PROFILES.get(p.sku, ("",))[0] == "staple"]
        basket_day = date(sim_start.year, sim_start.month, 1)
        while basket_day <= today:
            if basket_day >= sim_start:
                order_date = basket_day + timedelta(days=rng.randint(0, 2))
                for product in rng.sample(staples, min(len(staples), rng.randint(3, 5))):
                    _, q_lo, q_hi = SKU_PROFILES[product.sku]
                    sale_events.append({
                        "product": product,
                        "customer": hr,
                        "date": min(order_date, today),
                        "qty_base": rng.randint(q_lo, max(q_lo + 1, q_hi // 2)),
                    })
            month = basket_day.month + 1
            year = basket_day.year + (1 if month > 12 else 0)
            basket_day = date(year, 1 if month > 12 else month, 1)

        sale_events.sort(key=lambda event: event["date"])
        return po_events, sale_events

    def plan_po_event(self, rng, product, sources, receipt_date, today, qty_base, lead):
        """One planned replenishment line: order placed `lead` days before the
        receipt; late-prone suppliers receive after the expected date."""
        supplier = sources[0] if rng.random() < 0.7 else rng.choice(sources)
        lead_days_value = rng.randint(*lead)
        order_date = receipt_date - timedelta(days=lead_days_value)
        expected_date = order_date + timedelta(days=lead_days_value)
        is_late = (
            supplier.company_name in {
                "North Star Printing Supply",
                "Warehouse Direct Thailand",
            }
            and rng.random() < 0.7
        )
        received_date = min(
            today,
            expected_date + timedelta(days=rng.randint(2, 8) if is_late else rng.randint(-1, 2)),
        )
        return {
            "product": product,
            "supplier": supplier,
            "order_date": order_date,
            "expected_date": expected_date,
            "received_date": max(order_date, received_date),
            "qty_base": qty_base,
        }

    def seed_purchases(self, rng, suppliers, products, po_events):
        today = timezone.localdate()
        vat_modes = ["not_included", "included", "none", "not_included", "not_included"]
        purchases = []

        # Bucket planned receipt lines into PO documents by supplier + ISO week
        # so products sharing a supplier merge into realistic multi-line POs.
        buckets = {}
        for event in po_events:
            iso = event["order_date"].isocalendar()
            key = (event["supplier"].id, iso[0], iso[1])
            buckets.setdefault(key, []).append(event)

        ordered_buckets = sorted(
            buckets.values(), key=lambda lines: min(line["order_date"] for line in lines)
        )

        for index, lines in enumerate(ordered_buckets, start=1):
            supplier = lines[0]["supplier"]
            transaction_date = min(line["order_date"] for line in lines)
            age_days = (today - transaction_date).days
            vat_mode = vat_modes[index % len(vat_modes)]

            # Old receipts are the stock backbone and stay received; recent
            # orders may still be in flight.
            line_specs = []
            line_amounts = []
            for line in lines:
                product = line["product"]
                conversion = self.choose_unit(rng, product, True)
                factor = conversion.factor_to_base
                quantity = max(1, round(decimal(line["qty_base"]) / factor))
                day_offset = HISTORY_DAYS - age_days
                unit_cost = money(
                    product._seed_cost * factor * self.cost_drift(rng, max(0, day_offset))
                )
                discounts = self.discounts(rng)
                amount = line_amount(quantity, unit_cost, discounts)
                expected_date = line["expected_date"]
                if age_days > 25 or rng.random() < 0.88:
                    item_status = PurchaseItem.ITEM_RECEIVED
                    received_date = line["received_date"]
                else:
                    # A recent order still in flight: keep it pending with a
                    # FUTURE expected date so it reads as incoming stock, not
                    # an overdue PO (the deliberate delayed-PO cases are seeded
                    # separately in seed_state_adjustments).
                    item_status = PurchaseItem.ITEM_PENDING
                    received_date = None
                    expected_date = today + timedelta(days=rng.randint(2, 10))
                line_specs.append({
                    "product": product,
                    "conversion": conversion,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "discounts": discounts,
                    "amount": amount,
                    "expected_date": expected_date,
                    "item_status": item_status,
                    "received_date": received_date,
                })
                line_amounts.append(amount)

            statuses = {spec["item_status"] for spec in line_specs}
            if statuses == {PurchaseItem.ITEM_RECEIVED}:
                status = Purchase.STATUS_RECEIVED
            elif PurchaseItem.ITEM_RECEIVED in statuses:
                status = Purchase.STATUS_PARTIALLY_RECEIVED
            else:
                status = Purchase.STATUS_ORDERED

            purchases.append(
                self.create_purchase_document(
                    rng, supplier, transaction_date, status, vat_mode, line_specs, index
                )
            )

        # Status-variety documents that never affect stock: cancelled POs
        # through the history, plus a few recent drafts awaiting confirmation.
        for serial in range(1, 13):
            ago = rng.randint(10, HISTORY_DAYS - 10)
            transaction_date = today - timedelta(days=ago)
            supplier = suppliers[serial % len(suppliers)]
            line_specs = self.simple_po_lines(
                rng, rng.sample(products, rng.choice([1, 2])), transaction_date, today,
                item_status=PurchaseItem.ITEM_CANCELLED,
            )
            purchases.append(
                self.create_purchase_document(
                    rng, supplier, transaction_date,
                    Purchase.STATUS_CANCELLED, "not_included", line_specs, 900 + serial,
                )
            )
        for serial in range(1, 7):
            transaction_date = today - timedelta(days=rng.randint(0, 12))
            supplier = suppliers[(serial * 4) % len(suppliers)]
            line_specs = self.simple_po_lines(
                rng, rng.sample(products, rng.choice([1, 2, 3])), transaction_date, today,
                item_status=PurchaseItem.ITEM_PENDING,
            )
            purchases.append(
                self.create_purchase_document(
                    rng, supplier, transaction_date,
                    Purchase.STATUS_DRAFT, "not_included", line_specs, 950 + serial,
                )
            )

        return purchases

    def simple_po_lines(self, rng, line_products, transaction_date, today, item_status):
        line_specs = []
        for product in line_products:
            conversion = self.choose_unit(rng, product, True)
            quantity = rng.choice([1, 2, 3, 4, 5])
            age_days = (today - transaction_date).days
            unit_cost = money(
                product._seed_cost
                * conversion.factor_to_base
                * self.cost_drift(rng, max(0, HISTORY_DAYS - age_days))
            )
            discounts = self.discounts(rng)
            # Pending (draft/ordered) lines expect delivery in the future so
            # they read as incoming stock — never as accidental overdue POs.
            expected_date = (
                today + timedelta(days=rng.choice([3, 5, 7, 10]))
                if item_status == PurchaseItem.ITEM_PENDING
                else transaction_date + timedelta(days=rng.choice([3, 5, 7, 10]))
            )
            line_specs.append({
                "product": product,
                "conversion": conversion,
                "quantity": quantity,
                "unit_cost": unit_cost,
                "discounts": discounts,
                "amount": line_amount(quantity, unit_cost, discounts),
                "expected_date": expected_date,
                "item_status": item_status,
                "received_date": None,
            })
        return line_specs

    def create_purchase_document(self, rng, supplier, transaction_date, status, vat_mode, line_specs, index):
        line_amounts = [spec["amount"] for spec in line_specs]
        total_before_vat, vat_amount, grand_total = transaction_totals(line_amounts, vat_mode)
        payment_term_type = supplier.term_type or ""
        payment_term_days = supplier.billing_note_date if payment_term_type == "credit" else ""
        if payment_term_type == "cash":
            payment_date = transaction_date
        elif payment_term_type == "credit":
            days_value = "".join(c for c in payment_term_days if c.isdigit())
            payment_date = transaction_date + timedelta(days=int(days_value)) if days_value else None
        else:
            payment_date = None
        supplier_tax_invoice = (
            ""
            if status == Purchase.STATUS_DRAFT or index % 11 == 0
            else f"{supplier.taxpayer_id[-4:]}-{transaction_date:%y%m}-{index:04d}"
        )
        purchase = Purchase.objects.create(
            id=self.next_demo_id(Purchase, "demo-po-"),
            reference_no=self.next_reference_no(Purchase, "PO", transaction_date),
            supplier=supplier,
            supplier_name=supplier.company_name,
            supplier_tax_invoice=supplier_tax_invoice,
            status=status,
            transaction_date=transaction_date,
            payment_term_type=payment_term_type,
            payment_term_days=payment_term_days,
            payment_date=payment_date,
            note=self.purchase_note(status, supplier.company_name, index),
            vat_mode=vat_mode,
            total_before_vat=total_before_vat,
            vat_amount=vat_amount,
            grand_total=grand_total,
        )
        for item in line_specs:
            product = item["product"]
            conversion = item["conversion"]
            quantity = decimal(item["quantity"])
            PurchaseItem.objects.create(
                purchase=purchase,
                product=product,
                product_name=product.product_name,
                sku=product.sku,
                expected_delivery_date=item["expected_date"],
                item_status=item["item_status"],
                received_date=item["received_date"],
                lead_time_days=lead_days(transaction_date, item["expected_date"]),
                unit=conversion.unit,
                base_unit=product.stock_base_unit,
                conversion_factor=conversion.factor_to_base,
                quantity=quantity,
                base_quantity=quantity * conversion.factor_to_base,
                unit_cost=item["unit_cost"],
                discounts=item["discounts"],
                amount=item["amount"],
            )
        full_base = sum(decimal(item["amount"]) for item in line_specs)
        payable_base = sum(
            decimal(item["amount"])
            for item in line_specs
            if item["item_status"] != "cancelled"
        )
        purchase.payable_total = (
            grand_total
            if full_base <= 0
            else money(grand_total * (payable_base / full_base))
        )
        purchase.save(update_fields=["payable_total"])
        return purchase

    def purchase_note(self, status, supplier_name, index):
        notes = {
            Purchase.STATUS_DRAFT: f"Awaiting final confirmation from {supplier_name}.",
            Purchase.STATUS_ORDERED: "Supplier confirmed the order; receiving is still pending.",
            Purchase.STATUS_PARTIALLY_RECEIVED: "First shipment received; remaining items still open.",
            Purchase.STATUS_RECEIVED: "Received and checked by warehouse team.",
            Purchase.STATUS_CANCELLED: "Cancelled after supplier could not meet delivery schedule.",
        }
        suffix = ["Includes converted units.", "Tax invoice to be reconciled.", "Price includes tier discount.", "Urgent replenishment."][index % 4]
        return f"{notes[status]} {suffix}"

    def seed_quotations(self, rng, suppliers, customers, products):
        latest_quotation_date = timezone.localdate()
        start_date = latest_quotation_date - timedelta(days=HISTORY_DAYS - 14)
        quotation_count = 26
        day_span = max(1, (latest_quotation_date - start_date).days)
        vat_modes = ["not_included", "included", "none", "not_included"]
        validity_patterns = (
            ("calendar", 30),
            ("business", 21),
            ("calendar", 45),
            ("no_valid_date", 0),
        )
        quotations = []

        for index in range(1, quotation_count + 1):
            day_offset = round((index - 1) * day_span / max(1, quotation_count - 1))
            quotation_date = min(
                latest_quotation_date,
                start_date + timedelta(days=day_offset),
            )
            customer = customers[index % len(customers)]
            supplier = suppliers[(index * 2) % len(suppliers)]
            vat_mode = vat_modes[index % len(vat_modes)]
            valid_until_day_type, valid_until_days = validity_patterns[
                (index - 1) % len(validity_patterns)
            ]
            if valid_until_day_type == "no_valid_date":
                valid_until_date = None
            elif valid_until_day_type == "business":
                valid_until_date = add_business_days(quotation_date, valid_until_days)
            else:
                valid_until_date = quotation_date + timedelta(days=valid_until_days)
            item_count = rng.choice([1, 2, 2, 3, 4])
            selected_products = rng.sample(products, item_count)
            line_specs = []
            line_amounts = []

            for product in selected_products:
                conversion = self.choose_unit(rng, product, False)
                if conversion.factor_to_base < 1:
                    quantity = rng.choice([5, 10, 15, 20])
                else:
                    quantity = rng.choice([1, 2, 3, 4, 5, 8, 10])
                sale_price = money(
                    product._seed_price
                    * conversion.factor_to_base
                    * decimal(rng.uniform(0.96, 1.10))
                )
                cost_price = money(
                    product._seed_cost
                    * conversion.factor_to_base
                    * decimal(rng.uniform(0.94, 1.06))
                )
                discounts = self.discounts(rng, allow_multiple=True)
                amount = line_amount(quantity, sale_price, discounts)
                line_amounts.append(amount)
                line_specs.append(
                    {
                        "product": product,
                        "conversion": conversion,
                        "quantity": quantity,
                        "sale_price": sale_price,
                        "cost_price": cost_price,
                        "discounts": discounts,
                    }
                )

            total_before_vat, vat_amount, grand_total = transaction_totals(line_amounts, vat_mode)
            quotation = Quotation.objects.create(
                id=self.next_demo_id(Quotation, "demo-qt-"),
                reference_no=self.next_reference_no(
                    Quotation,
                    "QT",
                    sequential=True,
                ),
                quotation_date=quotation_date,
                valid_until_date=valid_until_date,
                valid_until_days=valid_until_days,
                valid_until_day_type=valid_until_day_type,
                customer=customer,
                customer_name=customer.company_name,
                supplier=supplier,
                supplier_name=supplier.company_name,
                vat_mode=vat_mode,
                note=f"Seed quotation for {customer.company_name}; prices based on current catalog.",
                total_before_vat=total_before_vat,
                vat_amount=vat_amount,
                grand_total=grand_total,
            )

            rows = []
            for position, item in enumerate(line_specs):
                product = item["product"]
                conversion = item["conversion"]
                quantity = decimal(item["quantity"])
                rows.append(
                    QuotationItem(
                        quotation=quotation,
                        product=product,
                        position=position,
                        product_name=product.product_name,
                        sku=product.sku,
                        unit=conversion.unit,
                        base_unit=product.stock_base_unit,
                        conversion_factor=conversion.factor_to_base,
                        quantity=quantity,
                        base_quantity=quantity * conversion.factor_to_base,
                        sale_price=item["sale_price"],
                        cost_price=item["cost_price"],
                        discounts=item["discounts"],
                    )
                )
            QuotationItem.objects.bulk_create(rows)

            # Multiple supplier options per line (same product priced from
            # several suppliers) so the quotation -> purchase conversion can
            # show the "choose supplier" case.
            option_rows = []
            for row, item in zip(rows, line_specs):
                option_count = rng.choice([1, 2, 2, 3])
                option_suppliers = rng.sample(
                    suppliers, min(option_count, len(suppliers))
                )
                for position, option_supplier in enumerate(option_suppliers):
                    option_cost = money(
                        item["cost_price"] * decimal(rng.uniform(0.88, 1.12))
                    )
                    option_rows.append(
                        QuotationItemSupplier(
                            quotation_item=row,
                            supplier=option_supplier,
                            supplier_name=option_supplier.company_name,
                            cost_price=option_cost,
                            position=position,
                            note="Preferred" if position == 0 else "",
                        )
                    )
            if option_rows:
                QuotationItemSupplier.objects.bulk_create(option_rows)
            quotations.append(quotation)

        return quotations

    def link_quotation_documents(self, rng, quotations, purchases, sales):
        """Point a subset of purchases and sales back to quotations so the
        document-reference chips (Source Quotation on a PO/sale, and
        "Purchase Orders Created" / "Sales Created" on a quotation) have data.
        Plenty of documents are left unlinked so the empty "—" case also shows.
        """
        linkable_purchases = [
            purchase
            for purchase in purchases
            if purchase.status != Purchase.STATUS_CANCELLED
            and purchase.source_quotation_id is None
        ]
        linkable_sales = [
            sale
            for sale in sales
            if sale.status != Sale.STATUS_CANCELLED
            and sale.source_quotation_id is None
        ]

        def take_match(pool, attr, value):
            # Prefer a same-party document, else fall back to any remaining one.
            for idx, doc in enumerate(pool):
                if getattr(doc, attr) == value:
                    return pool.pop(idx)
            return pool.pop(0) if pool else None

        for quotation in quotations[:12]:
            for _ in range(rng.choice([1, 1, 2])):
                purchase = take_match(
                    linkable_purchases, "supplier_name", quotation.supplier_name
                )
                if purchase is None:
                    break
                purchase.source_quotation = quotation
                purchase.save(update_fields=["source_quotation", "updated_at"])
            for _ in range(rng.choice([1, 1, 2])):
                sale = take_match(
                    linkable_sales, "customer_name", quotation.customer_name
                )
                if sale is None:
                    break
                sale.source_quotation = quotation
                sale.save(update_fields=["source_quotation", "updated_at"])

    def sale_item_statuses(self, status, count):
        if status == Sale.STATUS_DRAFT:
            return [SaleItem.ITEM_PENDING] * count
        if status == Sale.STATUS_PACKED:
            return [SaleItem.ITEM_PACKED] * count
        if status == Sale.STATUS_SHIPPED:
            return [SaleItem.ITEM_SHIPPED] * count
        if status == Sale.STATUS_DELIVERED:
            return [SaleItem.ITEM_DELIVERED] * count
        if status == Sale.STATUS_CANCELLED:
            return [SaleItem.ITEM_CANCELLED] * count
        if status == Sale.STATUS_RETURNED:
            return [SaleItem.ITEM_RETURNED] * count
        if status == Sale.STATUS_PARTIALLY_PACKED:
            return [SaleItem.ITEM_PACKED if i % 2 == 0 else SaleItem.ITEM_PENDING for i in range(count)]
        if status == Sale.STATUS_PARTIALLY_SHIPPED:
            return [SaleItem.ITEM_SHIPPED if i % 3 == 0 else SaleItem.ITEM_PACKED for i in range(count)]
        if status == Sale.STATUS_PARTIALLY_DELIVERED:
            return [SaleItem.ITEM_DELIVERED if i % 2 == 0 else SaleItem.ITEM_SHIPPED for i in range(count)]
        return [SaleItem.ITEM_PENDING] * count

    def maybe_add_credit_note_candidate_status(self, rng, sale_status, item_statuses):
        if len(item_statuses) < 2 or sale_status in {
            Sale.STATUS_CANCELLED,
            Sale.STATUS_RETURNED,
        }:
            return item_statuses
        if rng.random() >= 0.18:
            return item_statuses

        next_statuses = list(item_statuses)
        eligible_indexes = [
            index
            for index, item_status in enumerate(next_statuses)
            if item_status not in {SaleItem.ITEM_CANCELLED, SaleItem.ITEM_RETURNED}
        ]
        if not eligible_indexes:
            return next_statuses

        inactive_status = (
            SaleItem.ITEM_RETURNED
            if sale_status in {
                Sale.STATUS_SHIPPED,
                Sale.STATUS_PARTIALLY_SHIPPED,
                Sale.STATUS_DELIVERED,
                Sale.STATUS_PARTIALLY_DELIVERED,
            }
            and rng.random() < 0.6
            else SaleItem.ITEM_CANCELLED
        )
        next_statuses[rng.choice(eligible_indexes)] = inactive_status
        return next_statuses

    def sale_status_for_age(self, rng, age_days, line_count):
        """Realistic status mix: old orders are settled (delivered, with some
        cancelled/returned); only recent orders are still moving through the
        draft → packed → shipped pipeline."""
        multi = line_count > 1
        roll = rng.random()
        if age_days > 60:
            if roll < 0.86:
                return Sale.STATUS_DELIVERED
            if roll < 0.94:
                return Sale.STATUS_CANCELLED
            return Sale.STATUS_RETURNED
        if age_days > 21:
            if roll < 0.70:
                return Sale.STATUS_DELIVERED
            if roll < 0.78:
                return Sale.STATUS_SHIPPED
            if roll < 0.84:
                return Sale.STATUS_PARTIALLY_DELIVERED if multi else Sale.STATUS_SHIPPED
            if roll < 0.90:
                return Sale.STATUS_PACKED
            if roll < 0.96:
                return Sale.STATUS_CANCELLED
            return Sale.STATUS_RETURNED
        if roll < 0.30:
            return Sale.STATUS_DELIVERED
        if roll < 0.45:
            return Sale.STATUS_SHIPPED
        if roll < 0.53:
            return Sale.STATUS_PARTIALLY_SHIPPED if multi else Sale.STATUS_SHIPPED
        if roll < 0.65:
            return Sale.STATUS_PACKED
        if roll < 0.73:
            return Sale.STATUS_PARTIALLY_PACKED if multi else Sale.STATUS_PACKED
        if roll < 0.80:
            return Sale.STATUS_PARTIALLY_DELIVERED if multi else Sale.STATUS_DELIVERED
        if roll < 0.95:
            return Sale.STATUS_DRAFT
        if roll < 0.98:
            return Sale.STATUS_CANCELLED
        return Sale.STATUS_RETURNED

    def seed_sales(self, rng, customers, products, suppliers, sale_events):
        """Turn the planned demand events into sale documents: events from the
        same customer on the same date merge into one multi-line sale."""
        today = timezone.localdate()
        vat_modes = ["not_included", "included", "none", "not_included"]
        sales = []

        buckets = {}
        for event in sale_events:
            key = (event["customer"].id, event["date"])
            buckets.setdefault(key, []).append(event)
        ordered_buckets = sorted(
            buckets.values(), key=lambda events: (events[0]["date"], events[0]["customer"].id)
        )

        for index, events in enumerate(ordered_buckets, start=1):
            customer = events[0]["customer"]
            transaction_date = events[0]["date"]
            age_days = (today - transaction_date).days
            vat_mode = vat_modes[index % len(vat_modes)]
            payment_term_type = customer.term_type or ""
            payment_term_days = customer.billing_note_date if payment_term_type == "credit" else ""
            if payment_term_type == "cash":
                payment_date = transaction_date
            elif payment_term_type == "credit":
                days_value = "".join(c for c in payment_term_days if c.isdigit())
                payment_date = transaction_date + timedelta(days=int(days_value)) if days_value else None
            else:
                payment_date = None

            status = self.sale_status_for_age(rng, age_days, len(events))
            statuses = self.maybe_add_credit_note_candidate_status(
                rng,
                status,
                self.sale_item_statuses(status, len(events)),
            )

            line_specs = []
            line_amounts = []
            for event, item_status in zip(events, statuses):
                product = event["product"]
                conversion = self.choose_unit(rng, product, False)
                factor = conversion.factor_to_base
                quantity = max(1, round(decimal(event["qty_base"]) / factor))
                price_drift = self.cost_drift(rng, max(0, HISTORY_DAYS - age_days))
                unit_price = money(
                    product._seed_price * factor * price_drift * decimal(rng.uniform(1.0, 1.08))
                )
                discounts = self.discounts(rng, allow_multiple=True)
                amount = line_amount(quantity, unit_price, discounts)
                shipped_date = None
                delivered_date = None
                if item_status in {SaleItem.ITEM_SHIPPED, SaleItem.ITEM_DELIVERED}:
                    shipped_date = min(today, transaction_date + timedelta(days=rng.choice([0, 1, 2])))
                if item_status == SaleItem.ITEM_DELIVERED:
                    delivered_date = min(
                        today,
                        (shipped_date or transaction_date) + timedelta(days=rng.choice([0, 1, 2, 3])),
                    )
                # Record the source supplier and that supplier's unit cost on
                # the line so margin, the Sales detail Supplier/Unit Cost
                # columns, and below-cost warnings all have data. ~12% of
                # active lines are deliberately sold below cost to exercise the
                # loss case on the dashboard and the sales form warning.
                source_supplier = rng.choice(suppliers)
                base_cost = product._seed_cost * factor * price_drift
                effective_unit_price = (
                    amount / decimal(quantity) if quantity else decimal(unit_price)
                )
                if item_status not in {SaleItem.ITEM_CANCELLED, SaleItem.ITEM_RETURNED} and rng.random() < 0.12:
                    unit_cost = money(effective_unit_price * decimal(rng.uniform(1.05, 1.30)))
                else:
                    unit_cost = money(base_cost * decimal(rng.uniform(0.80, 0.97)))
                line_amounts.append(amount)
                line_specs.append({
                    "product": product,
                    "conversion": conversion,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "discounts": discounts,
                    "amount": amount,
                    "item_status": item_status,
                    "shipped_date": shipped_date,
                    "delivered_date": delivered_date,
                    "supplier": source_supplier,
                    "unit_cost": unit_cost,
                })

            total_before_vat, vat_amount, grand_total = transaction_totals(line_amounts, vat_mode)
            final_status = get_sale_status_from_item_statuses(
                [item["item_status"] for item in line_specs],
                fallback_status=status,
            )
            sale = Sale.objects.create(
                id=self.next_demo_id(Sale, "demo-sale-"),
                reference_no=self.next_reference_no(Sale, "TI", transaction_date),
                customer=customer,
                customer_name=customer.company_name,
                customer_po_reference=(
                    f"CPO-{transaction_date:%y%m}-{index:03d}" if index % 3 == 0 else ""
                ),
                status=final_status,
                payment_term_type=payment_term_type,
                payment_term_days=payment_term_days,
                payment_date=payment_date,
                transaction_date=transaction_date,
                note=self.sale_note(final_status, customer.company_name, index),
                vat_mode=vat_mode,
                total_before_vat=total_before_vat,
                vat_amount=vat_amount,
                grand_total=grand_total,
            )
            for item in line_specs:
                product = item["product"]
                conversion = item["conversion"]
                quantity = decimal(item["quantity"])
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    product_name=product.product_name,
                    sku=product.sku,
                    supplier=item["supplier"],
                    supplier_name=item["supplier"].company_name,
                    unit_cost=item["unit_cost"],
                    item_status=item["item_status"],
                    shipped_date=item["shipped_date"],
                    delivered_date=item["delivered_date"],
                    unit=conversion.unit,
                    base_unit=product.stock_base_unit,
                    conversion_factor=conversion.factor_to_base,
                    quantity=quantity,
                    base_quantity=quantity * conversion.factor_to_base,
                    unit_price=item["unit_price"],
                    discounts=item["discounts"],
                    amount=item["amount"],
                )
            sales.append(sale)
        return sales

    def sale_note(self, status, customer_name, index):
        notes = {
            Sale.STATUS_DRAFT: f"Pending stock or customer approval from {customer_name}.",
            Sale.STATUS_PARTIALLY_PACKED: "Warehouse has packed some lines; remaining lines still pending.",
            Sale.STATUS_PACKED: "Packed and ready for pickup or dispatch.",
            Sale.STATUS_PARTIALLY_SHIPPED: "Some lines shipped while other lines remain packed.",
            Sale.STATUS_SHIPPED: "Shipment has left the warehouse.",
            Sale.STATUS_PARTIALLY_DELIVERED: "One or more shipped lines are still waiting for proof of delivery.",
            Sale.STATUS_DELIVERED: "Delivered with completed delivery confirmation.",
            Sale.STATUS_CANCELLED: "Cancelled before final delivery.",
            Sale.STATUS_RETURNED: "Returned after delivery and removed from active stock.",
        }
        suffix = ["Billing follows customer cycle.", "Includes line discounts.", "Mixed unit quantities.", "Urgent department request."][index % 4]
        return f"{notes[status]} {suffix}"

    # ── Final-state adjustments ──────────────────────────────────────────
    def seed_state_adjustments(self, rng, suppliers, customers, products, purchases, sales):
        """Nudge each product's CURRENT stock into its archetype's target band
        (computed against the same reorder point the app itself derives), then
        layer on the open-order edge cases: replacement POs already in flight,
        overdue POs, and customer backorders bigger than stock + incoming."""
        today = timezone.localdate()
        report = {row["product_id"]: row for row in build_stock_report()}

        for idx, product in enumerate(products):
            profile_name, params, qty_lo, qty_hi = self.product_profile(product)
            final = params["final"]
            row = report.get(product.id)
            if not row or final == "skip":
                continue
            available = decimal(row["available_stock"] or 0)
            reorder = decimal(row["reorder_level"] or 0)
            received = decimal(row["received_purchase_units"] or 0)
            if reorder <= 0:
                reorder = decimal(max(qty_hi, 10))

            if final == "healthy":
                if available < reorder * decimal("1.6"):
                    target = reorder * decimal(str(rng.uniform(1.7, 2.2)))
                elif available > reorder * decimal("3.2"):
                    target = reorder * decimal(str(rng.uniform(2.0, 2.6)))
                else:
                    continue
            elif final == "watch":
                target = reorder * decimal(str(rng.uniform(1.08, 1.22)))
            elif final == "low":
                target = reorder * decimal(str(rng.uniform(0.35, 0.85)))
            elif final == "out":
                target = Decimal("0")
            elif final == "oversold":
                # Sell PAST zero so raw stock goes negative (oversold badge).
                target = -(received * Decimal("0.06"))
            elif final == "backorder":
                target = reorder * decimal(str(rng.uniform(0.25, 0.6)))
            else:
                continue

            delta = int(round(available - target))
            if delta > 0:
                customer = customers[(idx * 7) % len(customers)]
                sale_date = today - timedelta(days=rng.randint(2, 8))
                sales.append(
                    self.create_adjustment_sale(rng, product, customer, sale_date, delta, suppliers)
                )
            elif delta < 0:
                supplier = suppliers[(idx * 3) % len(suppliers)]
                received_date = today - timedelta(days=rng.randint(1, 5))
                purchases.append(
                    self.create_adjustment_purchase(
                        rng, supplier, product, -delta,
                        received_date=received_date,
                    )
                )

        products_by_sku = {product.sku: product for product in products}
        added_incoming = {}

        # Replacement stock already ordered for some low/out items (the others
        # stay urgent with nothing on the way — the Quick-PO case).
        for serial, sku in enumerate(sorted(INCOMING_RELIEF_SKUS), start=1):
            product = products_by_sku.get(sku)
            row = report.get(product.id) if product else None
            if not row:
                continue
            qty = max(int(decimal(row["reorder_level"] or 0) * decimal("1.3")), 10)
            supplier = suppliers[(serial * 5) % len(suppliers)]
            order_date = today - timedelta(days=rng.randint(1, 6))
            added_incoming[sku] = added_incoming.get(sku, 0) + qty
            purchases.append(
                self.create_adjustment_purchase(
                    rng, supplier, product, qty,
                    order_date=order_date,
                    expected_date=today + timedelta(days=rng.randint(2, 6)),
                    pending=True,
                )
            )

        # Purchase orders that are overdue: expected date already passed, items
        # still pending (delayed_purchase_units + dispatch attention).
        for serial, sku in enumerate(sorted(DELAYED_PO_SKUS), start=1):
            product = products_by_sku.get(sku)
            if not product:
                continue
            supplier = suppliers[(serial * 9 + 5) % len(suppliers)]
            order_date = today - timedelta(days=rng.randint(20, 32))
            qty = rng.randint(20, 60)
            added_incoming[sku] = added_incoming.get(sku, 0) + qty
            purchases.append(
                self.create_adjustment_purchase(
                    rng, supplier, product, qty,
                    order_date=order_date,
                    expected_date=today - timedelta(days=rng.randint(5, 10)),
                    pending=True,
                )
            )

        # Open customer demand bigger than stock + ALL incoming (backorder
        # table) — including the relief/delayed POs created just above.
        for serial, sku in enumerate(sorted(BACKORDER_SKUS), start=1):
            product = products_by_sku.get(sku)
            row = report.get(product.id) if product else None
            if not row:
                continue
            shortfall_base = int(
                (
                    decimal(row["available_stock"] or 0)
                    + decimal(row["pending_purchase_units"] or 0)
                    + decimal(row["delayed_purchase_units"] or 0)
                    + decimal(added_incoming.get(sku, 0))
                )
                * decimal("1.6")
                + decimal(row["reorder_level"] or 10)
            )
            customer = customers[(serial * 11) % len(customers)]
            sale_date = today - timedelta(days=rng.randint(0, 3))
            sales.append(
                self.create_adjustment_sale(
                    rng, product, customer, sale_date, max(shortfall_base, 10), suppliers,
                    status=Sale.STATUS_DRAFT,
                )
            )

        # One deliberately split delivery: first line booked in, second line
        # still on the truck (partially-received PO state).
        split_products = [
            products_by_sku[sku]
            for sku in ("TISSUE-BOX", "CUP-PAPER-8OZ")
            if sku in products_by_sku
        ]
        if len(split_products) == 2:
            supplier = suppliers[7 % len(suppliers)]
            order_date = today - timedelta(days=6)
            line_specs = []
            for position, product in enumerate(split_products):
                conversion = self.base_conversion(product)
                quantity = rng.randint(20, 60)
                unit_cost = money(product._seed_cost * self.cost_drift(rng, HISTORY_DAYS))
                amount = line_amount(quantity, unit_cost, [])
                received = position == 0
                line_specs.append({
                    "product": product,
                    "conversion": conversion,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "discounts": [],
                    "amount": amount,
                    "expected_date": today + timedelta(days=2) if not received else order_date + timedelta(days=4),
                    "item_status": PurchaseItem.ITEM_RECEIVED if received else PurchaseItem.ITEM_PENDING,
                    "received_date": order_date + timedelta(days=4) if received else None,
                })
            purchases.append(
                self.create_purchase_document(
                    rng, supplier, order_date, Purchase.STATUS_PARTIALLY_RECEIVED,
                    "not_included", line_specs, 2998,
                )
            )

        # A few recent multi-line orders frozen mid-pipeline so the partial
        # pack/ship/delivery states always have live documents.
        partial_statuses = [
            Sale.STATUS_PARTIALLY_PACKED,
            Sale.STATUS_PARTIALLY_PACKED,
            Sale.STATUS_PARTIALLY_SHIPPED,
            Sale.STATUS_PARTIALLY_DELIVERED,
        ]
        healthy_staples = [
            products_by_sku[sku]
            for sku, (profile, _lo, _hi) in SKU_PROFILES.items()
            if profile == "staple" and sku in products_by_sku
        ]
        for serial, status in enumerate(partial_statuses, start=1):
            customer = customers[(serial * 3 + 1) % len(customers)]
            sale_date = today - timedelta(days=rng.randint(1, 6))
            chosen = rng.sample(healthy_staples, min(3, len(healthy_staples)))
            sales.append(
                self.create_partial_sale(rng, chosen, customer, sale_date, status, suppliers)
            )

    def base_conversion(self, product):
        return next(
            conversion
            for conversion in product.unit_conversions.all()
            if conversion.factor_to_base == Decimal("1")
        )

    def create_adjustment_purchase(
        self, rng, supplier, product, qty_base,
        received_date=None, order_date=None, expected_date=None, pending=False,
    ):
        conversion = self.base_conversion(product)
        if order_date is None:
            order_date = (received_date or timezone.localdate()) - timedelta(days=rng.randint(2, 6))
        if expected_date is None:
            expected_date = received_date or order_date + timedelta(days=rng.randint(2, 6))
        unit_cost = money(product._seed_cost * self.cost_drift(rng, HISTORY_DAYS))
        amount = line_amount(qty_base, unit_cost, [])
        line_specs = [{
            "product": product,
            "conversion": conversion,
            "quantity": qty_base,
            "unit_cost": unit_cost,
            "discounts": [],
            "amount": amount,
            "expected_date": expected_date,
            "item_status": PurchaseItem.ITEM_PENDING if pending else PurchaseItem.ITEM_RECEIVED,
            "received_date": None if pending else received_date,
        }]
        status = Purchase.STATUS_ORDERED if pending else Purchase.STATUS_RECEIVED
        return self.create_purchase_document(
            rng, supplier, order_date, status, "not_included", line_specs,
            rng.randint(2000, 2999),
        )

    def create_adjustment_sale(self, rng, product, customer, transaction_date, qty_base, suppliers, status=Sale.STATUS_DELIVERED):
        conversion = self.base_conversion(product)
        unit_price = money(product._seed_price * decimal(str(rng.uniform(0.97, 1.06))))
        amount = line_amount(qty_base, unit_price, [])
        total_before_vat, vat_amount, grand_total = transaction_totals([amount], "not_included")
        item_status = self.sale_item_statuses(status, 1)[0]
        note = (
            "Bulk department request cleared from stock."
            if status == Sale.STATUS_DELIVERED
            else "Awaiting stock — customer order exceeds what is on hand."
        )
        sale = Sale.objects.create(
            id=self.next_demo_id(Sale, "demo-sale-"),
            reference_no=self.next_reference_no(Sale, "TI", transaction_date),
            customer=customer,
            customer_name=customer.company_name,
            status=status,
            payment_term_type=customer.term_type or "",
            payment_term_days=customer.billing_note_date if (customer.term_type or "") == "credit" else "",
            payment_date=None,
            transaction_date=transaction_date,
            note=note,
            vat_mode="not_included",
            total_before_vat=total_before_vat,
            vat_amount=vat_amount,
            grand_total=grand_total,
        )
        today = timezone.localdate()
        shipped_date = transaction_date if item_status in {SaleItem.ITEM_SHIPPED, SaleItem.ITEM_DELIVERED} else None
        delivered_date = (
            min(transaction_date + timedelta(days=1), today)
            if item_status == SaleItem.ITEM_DELIVERED
            else None
        )
        supplier = rng.choice(suppliers)
        SaleItem.objects.create(
            sale=sale,
            product=product,
            product_name=product.product_name,
            sku=product.sku,
            supplier=supplier,
            supplier_name=supplier.company_name,
            unit_cost=money(product._seed_cost * decimal("0.95")),
            item_status=item_status,
            shipped_date=shipped_date,
            delivered_date=delivered_date,
            unit=conversion.unit,
            base_unit=product.stock_base_unit,
            conversion_factor=Decimal("1"),
            quantity=decimal(qty_base),
            base_quantity=decimal(qty_base),
            unit_price=unit_price,
            discounts=[],
            amount=amount,
        )
        return sale

    def create_partial_sale(self, rng, line_products, customer, transaction_date, status, suppliers):
        """A small recent multi-line sale frozen in a partial pipeline state
        (partially packed/shipped/delivered)."""
        item_statuses = self.sale_item_statuses(status, len(line_products))
        line_specs = []
        line_amounts = []
        today = timezone.localdate()
        for product, item_status in zip(line_products, item_statuses):
            conversion = self.base_conversion(product)
            quantity = rng.randint(3, 12)
            unit_price = money(product._seed_price * decimal(str(rng.uniform(0.98, 1.06))))
            amount = line_amount(quantity, unit_price, [])
            shipped_date = (
                min(transaction_date + timedelta(days=1), today)
                if item_status in {SaleItem.ITEM_SHIPPED, SaleItem.ITEM_DELIVERED}
                else None
            )
            delivered_date = (
                min(transaction_date + timedelta(days=2), today)
                if item_status == SaleItem.ITEM_DELIVERED
                else None
            )
            line_specs.append({
                "product": product,
                "conversion": conversion,
                "quantity": quantity,
                "unit_price": unit_price,
                "amount": amount,
                "item_status": item_status,
                "shipped_date": shipped_date,
                "delivered_date": delivered_date,
            })
            line_amounts.append(amount)
        total_before_vat, vat_amount, grand_total = transaction_totals(line_amounts, "not_included")
        final_status = get_sale_status_from_item_statuses(
            [spec["item_status"] for spec in line_specs], fallback_status=status
        )
        sale = Sale.objects.create(
            id=self.next_demo_id(Sale, "demo-sale-"),
            reference_no=self.next_reference_no(Sale, "TI", transaction_date),
            customer=customer,
            customer_name=customer.company_name,
            status=final_status,
            payment_term_type=customer.term_type or "",
            payment_term_days=customer.billing_note_date if (customer.term_type or "") == "credit" else "",
            payment_date=None,
            transaction_date=transaction_date,
            note="Department order currently being processed by the warehouse.",
            vat_mode="not_included",
            total_before_vat=total_before_vat,
            vat_amount=vat_amount,
            grand_total=grand_total,
        )
        for spec in line_specs:
            product = spec["product"]
            supplier = rng.choice(suppliers)
            SaleItem.objects.create(
                sale=sale,
                product=product,
                product_name=product.product_name,
                sku=product.sku,
                supplier=supplier,
                supplier_name=supplier.company_name,
                unit_cost=money(product._seed_cost * decimal("0.95")),
                item_status=spec["item_status"],
                shipped_date=spec["shipped_date"],
                delivered_date=spec["delivered_date"],
                unit=spec["conversion"].unit,
                base_unit=product.stock_base_unit,
                conversion_factor=Decimal("1"),
                quantity=decimal(spec["quantity"]),
                base_quantity=decimal(spec["quantity"]),
                unit_price=spec["unit_price"],
                discounts=[],
                amount=spec["amount"],
            )
        return sale

    def seed_sale_allocations(self, sales):
        """Create FIFO layer allocations for every stock-deducting sale line so
        the per-layer availability shown in the inventory detail (FIFO table)
        matches the stock report. The deliberately oversold product allocates
        what it can and stays short — leaving the oversold case visible."""
        ordered = sorted(sales, key=lambda sale: (sale.transaction_date, sale.reference_no))
        for sale in ordered:
            for item in sale.items.select_related("product").all():
                if item.item_status not in SALE_STOCK_DEDUCTED_STATUSES:
                    continue
                try:
                    allocate_sale_item_fifo(item)
                except ValidationError:
                    pass

    def seed_billing_notes(self, rng, sales):
        eligible_statuses = {
            Sale.STATUS_DELIVERED,
            Sale.STATUS_PARTIALLY_DELIVERED,
            Sale.STATUS_SHIPPED,
        }
        grouped_sales = {}
        for sale in sales:
            if sale.status not in eligible_statuses:
                continue
            grouped_sales.setdefault(sale.customer_name, []).append(sale)

        # Build candidate chunks per customer across the WHOLE two-year
        # timeline, then sample evenly so AR documents exist in every period —
        # old ones mostly settled, recent ones still open, and a few stale
        # unpaid notes left as overdue AR.
        chunks = []
        for customer_name in sorted(grouped_sales):
            customer_sales = sorted(
                grouped_sales[customer_name],
                key=lambda row: (row.transaction_date, row.reference_no),
            )
            cursor = 0
            while cursor < len(customer_sales):
                line_count = min(len(customer_sales) - cursor, rng.choice([1, 1, 2, 2, 3]))
                chunks.append(customer_sales[cursor : cursor + line_count])
                cursor += line_count
        chunks.sort(key=lambda selected: max(sale.transaction_date for sale in selected))
        max_notes = 64
        if len(chunks) > max_notes:
            step = len(chunks) / max_notes
            chunks = [chunks[int(i * step)] for i in range(max_notes)]

        today = timezone.localdate()
        billing_notes = []
        serial = 1

        for selected_sales in chunks:
            latest_sale_date = max(sale.transaction_date for sale in selected_sales)
            billing_note_date = min(
                today,
                latest_sale_date + timedelta(days=rng.choice([2, 4, 7, 10])),
            )
            sale_payment_dates = [sale.payment_date for sale in selected_sales if sale.payment_date]
            expected_payment_date = (
                max(sale_payment_dates)
                if sale_payment_dates
                else billing_note_date + timedelta(days=30)
            )
            age_days = (today - billing_note_date).days
            roll = rng.random()
            if age_days > 120:
                if roll < 0.82:
                    status = BillingNote.STATUS_FULLY_RECEIVED
                elif roll < 0.92:
                    status = BillingNote.STATUS_ISSUED
                else:
                    status = BillingNote.STATUS_CANCELLED
            elif age_days > 30:
                if roll < 0.55:
                    status = BillingNote.STATUS_FULLY_RECEIVED
                elif roll < 0.75:
                    status = BillingNote.STATUS_PARTIALLY_RECEIVED
                else:
                    status = BillingNote.STATUS_ISSUED
            else:
                if roll < 0.60:
                    status = BillingNote.STATUS_ISSUED
                elif roll < 0.85:
                    status = BillingNote.STATUS_PARTIALLY_RECEIVED
                else:
                    status = BillingNote.STATUS_FULLY_RECEIVED
            customer_name = selected_sales[0].customer_name
            customer = selected_sales[0].customer
            billing_note = BillingNote.objects.create(
                id=self.next_demo_id(BillingNote, "demo-bn-"),
                reference_no=self.next_reference_no(
                    BillingNote,
                    "BN",
                    billing_note_date,
                ),
                customer=customer,
                customer_name=customer_name,
                billing_note_date=billing_note_date,
                expected_payment_date=expected_payment_date,
                status=status,
                bank_reference=(
                    f"KB-BN-{billing_note_date:%y%m}-{serial:03d}"
                    if status == BillingNote.STATUS_FULLY_RECEIVED
                    else ""
                ),
                note=self.billing_note_note(status, customer_name),
            )
            line_rows = []
            total_amount = Decimal("0.00")
            for line_index, sale in enumerate(selected_sales):
                received = status == BillingNote.STATUS_FULLY_RECEIVED or (
                    status == BillingNote.STATUS_PARTIALLY_RECEIVED and line_index == 0
                )
                received_date = None
                if received:
                    received_date = min(
                        timezone.localdate(),
                        (sale.payment_date or expected_payment_date)
                        + timedelta(days=rng.choice([-1, 0, 1, 2])),
                    )
                amount = money(sale.grand_total)
                line_rows.append(
                    BillingNoteLine(
                        billing_note=billing_note,
                        sale=sale,
                        received=received,
                        received_date=received_date,
                        amount=amount,
                    )
                )
                total_amount += amount
            BillingNoteLine.objects.bulk_create(line_rows)

            received_dates = [
                line.received_date
                for line in line_rows
                if line.received and line.received_date
            ]
            billing_note.total_amount = total_amount
            billing_note.actual_payment_date = max(received_dates) if received_dates else None
            billing_note.save(update_fields=["total_amount", "actual_payment_date", "updated_at"])
            billing_notes.append(billing_note)
            serial += 1

        return billing_notes

    def billing_note_note(self, status, customer_name):
        notes = {
            BillingNote.STATUS_ISSUED: f"Issued to {customer_name}; waiting for finance confirmation.",
            BillingNote.STATUS_PARTIALLY_RECEIVED: "Some invoices in this billing note have been received.",
            BillingNote.STATUS_FULLY_RECEIVED: "All invoices in this billing note have been received.",
            BillingNote.STATUS_CANCELLED: "Cancelled after customer requested revised billing.",
            BillingNote.STATUS_DRAFT: "Draft billing note prepared for review.",
        }
        return notes[status]

    def seed_payment_batches(self, rng, purchases):
        eligible_statuses = {
            Purchase.STATUS_RECEIVED,
            Purchase.STATUS_PARTIALLY_RECEIVED,
        }
        grouped_purchases = {}
        for purchase in purchases:
            if purchase.status not in eligible_statuses:
                continue
            grouped_purchases.setdefault(purchase.supplier_name, []).append(purchase)

        # Same spread-over-time approach as billing notes: AP exists in every
        # period, old batches mostly paid, recent ones scheduled or partial.
        chunks = []
        for supplier_name in sorted(grouped_purchases):
            supplier_purchases = sorted(
                grouped_purchases[supplier_name],
                key=lambda row: (row.transaction_date, row.reference_no),
            )
            cursor = 0
            while cursor < len(supplier_purchases):
                line_count = min(len(supplier_purchases) - cursor, rng.choice([1, 1, 2, 2, 3]))
                chunks.append(supplier_purchases[cursor : cursor + line_count])
                cursor += line_count
        chunks.sort(key=lambda selected: max(purchase.transaction_date for purchase in selected))
        max_batches = 52
        if len(chunks) > max_batches:
            step = len(chunks) / max_batches
            chunks = [chunks[int(i * step)] for i in range(max_batches)]

        today = timezone.localdate()
        payment_batches = []
        serial = 1

        for selected_purchases in chunks:
            supplier_name = selected_purchases[0].supplier_name
            latest_purchase_date = max(purchase.transaction_date for purchase in selected_purchases)
            batch_date = min(
                timezone.localdate(),
                latest_purchase_date + timedelta(days=rng.choice([2, 5, 8, 12])),
            )
            purchase_payment_dates = [
                purchase.payment_date
                for purchase in selected_purchases
                if purchase.payment_date
            ]
            planned_payment_date = (
                max(purchase_payment_dates)
                if purchase_payment_dates
                else batch_date + timedelta(days=30)
            )
            age_days = (today - batch_date).days
            roll = rng.random()
            if age_days > 120:
                if roll < 0.84:
                    status = PaymentBatch.STATUS_PAID
                elif roll < 0.93:
                    status = PaymentBatch.STATUS_SCHEDULED
                else:
                    status = PaymentBatch.STATUS_CANCELLED
            elif age_days > 30:
                if roll < 0.55:
                    status = PaymentBatch.STATUS_PAID
                elif roll < 0.75:
                    status = PaymentBatch.STATUS_PARTIALLY_PAID
                else:
                    status = PaymentBatch.STATUS_SCHEDULED
            else:
                if roll < 0.55:
                    status = PaymentBatch.STATUS_SCHEDULED
                elif roll < 0.80:
                    status = PaymentBatch.STATUS_PARTIALLY_PAID
                else:
                    status = PaymentBatch.STATUS_PAID
            supplier = selected_purchases[0].supplier
            payment_batch = PaymentBatch.objects.create(
                id=self.next_demo_id(PaymentBatch, "demo-pmt-"),
                reference_no=self.next_reference_no(
                    PaymentBatch,
                    "PMT",
                    batch_date,
                ),
                supplier=supplier,
                supplier_name=supplier_name,
                batch_date=batch_date,
                planned_payment_date=planned_payment_date,
                status=status,
                bank_reference=(
                    f"SCB-PMT-{batch_date:%y%m}-{serial:03d}"
                    if status == PaymentBatch.STATUS_PAID
                    else ""
                ),
                note=self.payment_batch_note(status, supplier_name),
            )
            line_rows = []
            total_amount = Decimal("0.00")
            for line_index, purchase in enumerate(selected_purchases):
                paid = status == PaymentBatch.STATUS_PAID or (
                    status == PaymentBatch.STATUS_PARTIALLY_PAID and line_index == 0
                )
                paid_date = None
                if paid:
                    paid_date = min(
                        timezone.localdate(),
                        (purchase.payment_date or planned_payment_date)
                        + timedelta(days=rng.choice([-1, 0, 1, 2])),
                    )
                amount = money(purchase.payable_total or purchase.grand_total)
                line_rows.append(
                    PaymentBatchLine(
                        payment_batch=payment_batch,
                        purchase=purchase,
                        paid=paid,
                        paid_date=paid_date,
                        amount=amount,
                    )
                )
                total_amount += amount
            PaymentBatchLine.objects.bulk_create(line_rows)

            paid_dates = [line.paid_date for line in line_rows if line.paid and line.paid_date]
            payment_batch.total_amount = total_amount
            payment_batch.actual_payment_date = max(paid_dates) if paid_dates else None
            payment_batch.save(update_fields=["total_amount", "actual_payment_date", "updated_at"])
            payment_batches.append(payment_batch)
            serial += 1

        return payment_batches

    def payment_batch_note(self, status, supplier_name):
        notes = {
            PaymentBatch.STATUS_SCHEDULED: f"Scheduled payment batch for {supplier_name}.",
            PaymentBatch.STATUS_PARTIALLY_PAID: "Some purchase invoices in this batch have been paid.",
            PaymentBatch.STATUS_PAID: "All purchase invoices in this batch have been paid.",
            PaymentBatch.STATUS_CANCELLED: "Cancelled after supplier credit note review.",
            PaymentBatch.STATUS_DRAFT: "Draft payment batch prepared for review.",
        }
        return notes[status]

    def seed_credit_notes(self, rng, sales, billing_notes):
        billing_notes_by_sale_id = {}
        for note in billing_notes:
            if note.status != BillingNote.STATUS_CANCELLED:
                for line in note.lines.all():
                    billing_notes_by_sale_id.setdefault(line.sale_id, []).append(note)

        sales_with_creditable_items = []
        for sale in sales:
            creditable_items = [
                item
                for item in sale.items.all()
                if item.item_status in {
                    SaleItem.ITEM_CANCELLED,
                    SaleItem.ITEM_RETURNED,
                }
            ]
            if creditable_items:
                sales_with_creditable_items.append((sale, creditable_items))

        sales_with_creditable_items.sort(
            key=lambda row: (
                0 if row[0].id in billing_notes_by_sale_id else 1,
                row[0].transaction_date,
                row[0].reference_no,
            )
        )

        credit_notes = []
        for serial, (sale, creditable_items) in enumerate(
            sales_with_creditable_items[:14], start=1
        ):
            credit_note_date = min(
                timezone.localdate(),
                sale.transaction_date + timedelta(days=rng.choice([3, 5, 9])),
            )
            sale_billing_notes = billing_notes_by_sale_id.get(sale.id, [])
            billing_note = rng.choice(sale_billing_notes) if sale_billing_notes else None
            # Cover both credit-note states; every 4th note is cancelled.
            cn_status = (
                CreditNote.STATUS_CANCELLED
                if serial % 4 == 0
                else CreditNote.STATUS_ISSUED
            )
            cn_note = (
                f"Credit note cancelled after review on {sale.reference_no}."
                if cn_status == CreditNote.STATUS_CANCELLED
                else f"Credit note for cancelled or returned items on {sale.reference_no}."
            )
            credit_note = CreditNote.objects.create(
                id=self.next_demo_id(CreditNote, "demo-cn-"),
                reference_no=self.next_reference_no(
                    CreditNote,
                    "CN",
                    credit_note_date,
                ),
                customer=sale.customer,
                customer_name=sale.customer_name,
                sale=sale,
                sale_reference_no=sale.reference_no,
                billing_note=billing_note,
                credit_note_date=credit_note_date,
                status=cn_status,
                note=cn_note,
            )
            line_rows = []
            total_amount = Decimal("0.00")
            for item in creditable_items:
                amount = money(item.amount)
                line_rows.append(
                    CreditNoteLine(
                        credit_note=credit_note,
                        sale_item=item,
                        product_name=item.product_name,
                        sku=item.sku,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        amount=amount,
                    )
                )
                total_amount += amount
            CreditNoteLine.objects.bulk_create(line_rows)
            credit_note.total_amount = total_amount
            credit_note.save(update_fields=["total_amount", "updated_at"])
            credit_notes.append(credit_note)

        return credit_notes

    def seed_documents(self, rng, purchases, sales):
        selected_purchases = [purchase for i, purchase in enumerate(purchases) if i % 6 == 0 and purchase.status != Purchase.STATUS_DRAFT]
        selected_sales = [sale for i, sale in enumerate(sales) if i % 12 == 0 and sale.status != Sale.STATUS_DRAFT]
        for purchase in selected_purchases:
            for existing in purchase.documents.all():
                existing.file.delete(save=False)
                existing.delete()
            doc = PurchaseDocument(purchase=purchase)
            filename = f"tax-invoice-{purchase.reference_no.lower()}.txt"
            doc.file.save(
                filename,
                ContentFile(
                    (
                        f"Tax invoice for {purchase.reference_no}\n"
                        f"Supplier: {purchase.supplier_name}\n"
                        f"Total: {purchase.grand_total}\n"
                    ).encode("utf-8")
                ),
                save=True,
            )
        for sale in selected_sales:
            for existing in sale.documents.all():
                existing.file.delete(save=False)
                existing.delete()
            doc = SaleDocument(sale=sale)
            filename = f"delivery-note-{sale.reference_no.lower()}.txt"
            doc.file.save(
                filename,
                ContentFile(
                    (
                        f"Delivery note for {sale.reference_no}\n"
                        f"Customer: {sale.customer_name}\n"
                        f"Total: {sale.grand_total}\n"
                    ).encode("utf-8")
                ),
                save=True,
            )
