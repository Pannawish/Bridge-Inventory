"""Management command for clearing transactional demo data while preserving master data."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inventory.models import (
    BillingNote,
    Category,
    CreditNote,
    Customer,
    PaymentBatch,
    Product,
    ProductPicture,
    Purchase,
    PurchaseDocument,
    Quotation,
    Sale,
    SaleDocument,
    Supplier,
)


class Command(BaseCommand):
    help = (
        "Clear operational transaction data. Use --include-master-data to also "
        "remove categories, products, suppliers, and customers."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without changing the database.",
        )
        parser.add_argument(
            "--include-master-data",
            action="store_true",
            help=(
                "Also delete master data such as categories, products, suppliers, "
                "customers, and linked product pictures."
            ),
        )

    def _build_counts(self, include_master_data):
        counts = {
            "credit_notes": CreditNote.objects.count(),
            "billing_notes": BillingNote.objects.count(),
            "payment_batches": PaymentBatch.objects.count(),
            "quotations": Quotation.objects.count(),
            "sales": Sale.objects.count(),
            "sale_documents": SaleDocument.objects.count(),
            "purchases": Purchase.objects.count(),
            "purchase_documents": PurchaseDocument.objects.count(),
        }
        if include_master_data:
            counts.update(
                {
                    "product_pictures": ProductPicture.objects.count(),
                    "products": Product.objects.count(),
                    "categories": Category.objects.count(),
                    "suppliers": Supplier.objects.count(),
                    "customers": Customer.objects.count(),
                }
            )
        return counts

    def _delete_categories(self):
        while Category.objects.exists():
            deleted_count, _ = Category.objects.filter(children__isnull=True).delete()
            if deleted_count == 0:
                raise CommandError(
                    "Unable to clear all categories because protected child "
                    "relationships remain."
                )

    def _delete_master_data(self):
        for picture in ProductPicture.objects.select_related("product"):
            picture.file.delete(save=False)
            picture.delete()
        Product.objects.all().delete()
        self._delete_categories()
        Supplier.objects.all().delete()
        Customer.objects.all().delete()

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        include_master_data = options["include_master_data"]
        counts = self._build_counts(include_master_data)

        for label, count in counts.items():
            self.stdout.write(f"{label}: {count}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run only. No data was deleted."))
            return

        with transaction.atomic():
            # Delete dependent finance documents first because their lines protect transactions.
            # Credit notes PROTECT their source sale, so clear them before sales.
            CreditNote.objects.all().delete()
            BillingNote.objects.all().delete()
            PaymentBatch.objects.all().delete()
            Quotation.objects.all().delete()

            for document in SaleDocument.objects.select_related("sale"):
                document.file.delete(save=False)
                document.delete()
            for sale in Sale.objects.all():
                if sale.document:
                    sale.document.delete(save=False)
                sale.delete()

            for document in PurchaseDocument.objects.select_related("purchase"):
                document.file.delete(save=False)
                document.delete()
            for purchase in Purchase.objects.all():
                if purchase.document:
                    purchase.document.delete(save=False)
                purchase.delete()

            if include_master_data:
                self._delete_master_data()

        if include_master_data:
            self.stdout.write(
                self.style.SUCCESS(
                    "Operational data cleared. Master data was also cleared."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                "Operational data cleared. Master data was kept unchanged."
            )
        )
