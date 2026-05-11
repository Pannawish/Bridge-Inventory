from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import (
    BillingNote,
    PaymentBatch,
    Purchase,
    PurchaseDocument,
    Quotation,
    Sale,
    SaleDocument,
)


class Command(BaseCommand):
    help = (
        "Clear operational transaction data while keeping master data such as "
        "categories, products, suppliers, and customers."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without changing the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        counts = {
            "billing_notes": BillingNote.objects.count(),
            "payment_batches": PaymentBatch.objects.count(),
            "quotations": Quotation.objects.count(),
            "sales": Sale.objects.count(),
            "sale_documents": SaleDocument.objects.count(),
            "purchases": Purchase.objects.count(),
            "purchase_documents": PurchaseDocument.objects.count(),
        }

        for label, count in counts.items():
            self.stdout.write(f"{label}: {count}")

        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run only. No data was deleted."))
            return

        with transaction.atomic():
            # Delete dependent finance documents first because their lines protect transactions.
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

        self.stdout.write(
            self.style.SUCCESS(
                "Operational data cleared. Master data was kept unchanged."
            )
        )
