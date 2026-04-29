import random
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from inventory.models import (
    Category,
    Customer,
    Product,
    ProductUnitConversion,
    Purchase,
    PurchaseDocument,
    PurchaseItem,
    Sale,
    SaleDocument,
    SaleItem,
    Supplier,
)


VAT_RATE = Decimal("0.07")
CENT = Decimal("0.01")
PURCHASE_STATUSES = [
    Purchase.STATUS_DRAFT,
    Purchase.STATUS_ORDERED,
    Purchase.STATUS_PARTIALLY_RECEIVED,
    Purchase.STATUS_RECEIVED,
    Purchase.STATUS_CANCELLED,
]
SALE_STATUSES = [
    Sale.STATUS_DRAFT,
    Sale.STATUS_PARTIALLY_PACKED,
    Sale.STATUS_PACKED,
    Sale.STATUS_PARTIALLY_SHIPPED,
    Sale.STATUS_SHIPPED,
    Sale.STATUS_PARTIALLY_DELIVERED,
    Sale.STATUS_DELIVERED,
    Sale.STATUS_CANCELLED,
]


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


def reference(prefix, transaction_date, serial):
    buddhist_year = transaction_date.year + 543
    return f"{prefix}-{str(buddhist_year)[-2:]}{transaction_date.month:02d}-{serial:03d}"


class Command(BaseCommand):
    help = "Seed a large set of realistic operational inventory records."

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

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(260429)

        if not options["keep_previous_demo"]:
            self.remove_previous_demo_records()

        categories = self.seed_categories()
        suppliers = self.seed_suppliers()
        customers = self.seed_customers()
        products = self.seed_products(categories)
        purchases = self.seed_purchases(rng, suppliers, products)
        sales = self.seed_sales(rng, customers, products)

        if not options["skip_documents"]:
            self.seed_documents(rng, purchases, sales)

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded operational data: "
                f"{len(categories)} categories, {len(suppliers)} suppliers, "
                f"{len(customers)} customers, {len(products)} products, "
                f"{len(purchases)} purchases, {len(sales)} sales."
            )
        )

    def remove_previous_demo_records(self):
        for document in PurchaseDocument.objects.filter(purchase__id__startswith="demo-"):
            document.file.delete(save=False)
            document.delete()
        for document in SaleDocument.objects.filter(sale__id__startswith="demo-"):
            document.file.delete(save=False)
            document.delete()
        Purchase.objects.filter(id__startswith="demo-").delete()
        Sale.objects.filter(id__startswith="demo-").delete()
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
            ("Bangkok Office Supply Co., Ltd.", "0105567001181", "Bang Rak, Bangkok", "orders@bangkokoffice.co.th", "02-118-2400", "Head Office", "Net 30, accepts partial deliveries."),
            ("Siam Paper & Label Ltd.", "0105567002292", "Khlong Toei, Bangkok", "sales@siampaperlabel.co.th", "02-229-1400", "Head Office", "Paper goods, VAT included invoice options."),
            ("Eastern Stationery Wholesale", "0205567003303", "Mueang Chonburi", "wholesale@easternstationery.co.th", "038-330-220", "Chonburi", "Large carton orders."),
            ("Metro Packaging Hub", "0115567004414", "Bang Phli, Samut Prakan", "care@metropack.co.th", "02-441-8800", "Samut Prakan", "Packaging and no-VAT cash receipt cases."),
            ("Thai Tech Accessories", "0105567005525", "Huai Khwang, Bangkok", "b2b@thaitechaccessories.co.th", "02-552-0101", "Ratchada", "Requires prepayment for cables."),
            ("North Star Printing Supply", "0505567006636", "Mueang Chiang Mai", "orders@northstarprinting.co.th", "053-663-777", "Chiang Mai", "Printer ink and maintenance supplies."),
            ("Central Facilities Mart", "0105567007747", "Chatuchak, Bangkok", "supply@centralfacilities.co.th", "02-774-5151", "Chatuchak", "Pantry and cleaning supplies."),
            ("Smart Label Solutions", "0105567008858", "Lat Krabang, Bangkok", "team@smartlabel.co.th", "02-885-6400", "Lat Krabang", "Thermal labels and barcode supplies."),
            ("Apex Filing Systems", "0105567009969", "Pathum Wan, Bangkok", "sales@apexfiling.co.th", "02-996-4120", "Pathum Wan", "Folders, binders, and archive boxes."),
            ("Green Office Products", "0105567011070", "Nonthaburi", "service@greenoffice.co.th", "02-107-3000", "Nonthaburi", "Eco-friendly office supplies."),
            ("Rapid Event Supply", "0105567012181", "Din Daeng, Bangkok", "events@rapidsupply.co.th", "02-218-9060", "Din Daeng", "Rush orders for event materials."),
            ("Union Safety & Facility", "0105567013292", "Khlong Sam Wa, Bangkok", "orders@unionsafety.co.th", "02-329-4444", "Khlong Sam Wa", "Safety and facility consumables."),
            ("Premier Toner House", "0105567014303", "Phaya Thai, Bangkok", "billing@premiertoner.co.th", "02-430-9000", "Phaya Thai", "Toner, ink, and printer accessories."),
            ("Bright Desk Essentials", "0105567015414", "Mueang Pathum Thani", "hello@brightdesk.co.th", "02-541-2112", "Pathum Thani", "Small desk supplies."),
            ("Warehouse Direct Thailand", "0105567016525", "Bang Yai, Nonthaburi", "wd@warehousedirect.co.th", "02-652-8787", "Bang Yai", "Bulk stock with frequent backorders."),
        ]
        suppliers = []
        for idx, (name, taxpayer_id, location, email, tel, branch, remark) in enumerate(specs):
            supplier = Supplier.objects.filter(company_name=name).first()
            defaults = {
                "company_name": name,
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
                "billing_note_date": ["Invoice date", "Every Friday", "25th of each month", "On delivery"][idx % 4],
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
                "billing_note_date": ["Same day", "Month end", "15th of each month", "Before event"][idx % 4],
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
                    "picture_url": "",
                    "reorder_level": decimal(reorder),
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

    def seed_purchases(self, rng, suppliers, products):
        Purchase.objects.filter(reference_no__startswith="PO-69").delete()
        start_date = date(2026, 1, 6)
        latest_transaction_date = timezone.localdate()
        purchase_statuses = (
            [Purchase.STATUS_RECEIVED] * 34
            + [Purchase.STATUS_PARTIALLY_RECEIVED] * 10
            + [Purchase.STATUS_ORDERED] * 14
            + [Purchase.STATUS_DRAFT] * 8
            + [Purchase.STATUS_CANCELLED] * 6
        )
        vat_modes = ["not_included", "included", "none", "not_included", "not_included"]
        purchases = []
        day_span = max(1, (latest_transaction_date - start_date).days)
        for index, status in enumerate(purchase_statuses, start=1):
            day_offset = round((index - 1) * day_span / max(1, len(purchase_statuses) - 1))
            transaction_date = min(
                latest_transaction_date,
                start_date + timedelta(days=day_offset),
            )
            supplier = suppliers[index % len(suppliers)]
            vat_mode = vat_modes[index % len(vat_modes)]
            ref = reference("PO", transaction_date, index)
            supplier_tax_invoice = "" if status == Purchase.STATUS_DRAFT or index % 11 == 0 else f"{supplier.taxpayer_id[-4:]}-{transaction_date:%y%m}-{index:04d}"
            item_count = rng.choice([1, 2, 2, 3, 3, 4, 5])
            selected_products = rng.sample(products, item_count)
            line_specs = []
            line_amounts = []
            for line_index, product in enumerate(selected_products, start=1):
                conversion = self.choose_unit(rng, product, True)
                quantity = rng.choice([1, 2, 3, 4, 5, 6, 8, 10, 12])
                unit_cost = money(product._seed_cost * conversion.factor_to_base * decimal(rng.uniform(0.92, 1.08)))
                discounts = self.discounts(rng)
                amount = line_amount(quantity, unit_cost, discounts)
                expected_offset = rng.choice([2, 3, 5, 7, 10, 14, 21])
                expected_date = min(
                    latest_transaction_date,
                    transaction_date + timedelta(days=expected_offset),
                )
                if status == Purchase.STATUS_RECEIVED:
                    item_status = PurchaseItem.ITEM_RECEIVED
                    received_date = max(
                        transaction_date,
                        min(
                            latest_transaction_date,
                            expected_date + timedelta(days=rng.choice([-1, 0, 1, 2])),
                        ),
                    )
                elif status == Purchase.STATUS_PARTIALLY_RECEIVED:
                    item_status = PurchaseItem.ITEM_RECEIVED if line_index <= max(1, item_count // 2) else PurchaseItem.ITEM_PENDING
                    received_date = expected_date if item_status == PurchaseItem.ITEM_RECEIVED else None
                elif status == Purchase.STATUS_CANCELLED:
                    item_status = PurchaseItem.ITEM_CANCELLED
                    received_date = None
                else:
                    item_status = PurchaseItem.ITEM_PENDING
                    received_date = None
                line_amounts.append(amount)
                line_specs.append(
                    {
                        "product": product,
                        "conversion": conversion,
                        "quantity": quantity,
                        "unit_cost": unit_cost,
                        "discounts": discounts,
                        "amount": amount,
                        "expected_date": expected_date,
                        "item_status": item_status,
                        "received_date": received_date,
                    }
                )
            total_before_vat, vat_amount, grand_total = transaction_totals(line_amounts, vat_mode)
            purchase = Purchase.objects.create(
                reference_no=ref,
                supplier_name=supplier.company_name,
                supplier_tax_invoice=supplier_tax_invoice,
                status=status,
                transaction_date=transaction_date,
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
            purchases.append(purchase)
        return purchases

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
        if status == Sale.STATUS_PARTIALLY_PACKED:
            return [SaleItem.ITEM_PACKED if i % 2 == 0 else SaleItem.ITEM_PENDING for i in range(count)]
        if status == Sale.STATUS_PARTIALLY_SHIPPED:
            return [SaleItem.ITEM_SHIPPED if i % 3 == 0 else SaleItem.ITEM_PACKED for i in range(count)]
        if status == Sale.STATUS_PARTIALLY_DELIVERED:
            return [SaleItem.ITEM_DELIVERED if i % 2 == 0 else SaleItem.ITEM_SHIPPED for i in range(count)]
        return [SaleItem.ITEM_PENDING] * count

    def seed_sales(self, rng, customers, products):
        Sale.objects.filter(reference_no__startswith="TI-69").delete()
        start_date = date(2026, 1, 10)
        sale_statuses = (
            [Sale.STATUS_DELIVERED] * 42
            + [Sale.STATUS_SHIPPED] * 12
            + [Sale.STATUS_PACKED] * 12
            + [Sale.STATUS_PARTIALLY_DELIVERED] * 8
            + [Sale.STATUS_PARTIALLY_SHIPPED] * 8
            + [Sale.STATUS_PARTIALLY_PACKED] * 6
            + [Sale.STATUS_DRAFT] * 10
            + [Sale.STATUS_CANCELLED] * 8
        )
        vat_modes = ["not_included", "included", "none", "not_included"]
        sales = []
        for index, status in enumerate(sale_statuses, start=1):
            transaction_date = start_date + timedelta(days=index + rng.randint(0, 3))
            customer = customers[index % len(customers)]
            ref = reference("TI", transaction_date, index)
            vat_mode = vat_modes[index % len(vat_modes)]
            payment_timing = "later" if index % 3 == 0 or customer.billing_note_date != "Same day" else "instant"
            payment_received_date = transaction_date if payment_timing == "instant" else transaction_date + timedelta(days=rng.choice([7, 14, 21, 30, 45]))
            item_count = rng.choice([1, 2, 2, 3, 3, 4])
            selected_products = rng.sample(products, item_count)
            statuses = self.sale_item_statuses(status, item_count)
            line_specs = []
            line_amounts = []
            for line_index, product in enumerate(selected_products):
                conversion = self.choose_unit(rng, product, False)
                if conversion.factor_to_base < 1:
                    quantity = rng.choice([5, 10, 15, 20, 25])
                else:
                    quantity = rng.choice([1, 2, 3, 4, 5, 8, 10, 12, 20, 30])
                unit_price = money(product._seed_price * conversion.factor_to_base * decimal(rng.uniform(0.96, 1.12)))
                discounts = self.discounts(rng, allow_multiple=True)
                item_status = statuses[line_index]
                shipped_date = None
                delivered_date = None
                if item_status in {SaleItem.ITEM_SHIPPED, SaleItem.ITEM_DELIVERED}:
                    shipped_date = transaction_date + timedelta(days=rng.choice([0, 1, 2]))
                if item_status == SaleItem.ITEM_DELIVERED:
                    delivered_date = (shipped_date or transaction_date) + timedelta(days=rng.choice([0, 1, 2, 3]))
                amount = line_amount(quantity, unit_price, discounts)
                line_amounts.append(amount)
                line_specs.append(
                    {
                        "product": product,
                        "conversion": conversion,
                        "quantity": quantity,
                        "unit_price": unit_price,
                        "discounts": discounts,
                        "amount": amount,
                        "item_status": item_status,
                        "shipped_date": shipped_date,
                        "delivered_date": delivered_date,
                    }
                )
            total_before_vat, vat_amount, grand_total = transaction_totals(line_amounts, vat_mode)
            sale = Sale.objects.create(
                reference_no=ref,
                customer_name=customer.company_name,
                status=status,
                payment_timing=payment_timing,
                payment_received_date=payment_received_date,
                transaction_date=transaction_date,
                note=self.sale_note(status, customer.company_name, index),
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
        }
        suffix = ["Billing follows customer cycle.", "Includes line discounts.", "Mixed unit quantities.", "Urgent department request."][index % 4]
        return f"{notes[status]} {suffix}"

    def seed_documents(self, rng, purchases, sales):
        selected_purchases = [purchase for i, purchase in enumerate(purchases) if i % 4 == 0 and purchase.status != Purchase.STATUS_DRAFT]
        selected_sales = [sale for i, sale in enumerate(sales) if i % 5 == 0 and sale.status != Sale.STATUS_DRAFT]
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
