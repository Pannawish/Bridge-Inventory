import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone

import inventory.models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0004_payment_terms"),
    ]

    operations = [
        migrations.CreateModel(
            name="BillingNote",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.CharField(
                        default=inventory.models.billing_note_id,
                        max_length=80,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("reference_no", models.CharField(blank=True, max_length=80)),
                ("customer_name", models.CharField(max_length=255)),
                ("billing_note_date", models.DateField(default=timezone.localdate)),
                ("expected_payment_date", models.DateField(blank=True, null=True)),
                ("actual_payment_date", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("issued", "Issued"),
                            ("partially_received", "Partially received"),
                            ("fully_received", "Fully received"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="issued",
                        max_length=40,
                    ),
                ),
                ("bank_reference", models.CharField(blank=True, max_length=120)),
                ("note", models.TextField(blank=True)),
                (
                    "total_amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=14),
                ),
            ],
            options={
                "ordering": ["-billing_note_date", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="BillingNoteLine",
            fields=[
                (
                    "id",
                    models.CharField(
                        default=inventory.models.billing_note_line_id,
                        max_length=80,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("received", models.BooleanField(default=False)),
                ("received_date", models.DateField(blank=True, null=True)),
                (
                    "amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=14),
                ),
                (
                    "billing_note",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="inventory.billingnote",
                    ),
                ),
                (
                    "sale",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="billing_note_lines",
                        to="inventory.sale",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="PaymentBatch",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.CharField(
                        default=inventory.models.payment_batch_id,
                        max_length=80,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("reference_no", models.CharField(blank=True, max_length=80)),
                ("supplier_name", models.CharField(max_length=255)),
                ("batch_date", models.DateField(default=timezone.localdate)),
                ("planned_payment_date", models.DateField(blank=True, null=True)),
                ("actual_payment_date", models.DateField(blank=True, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("scheduled", "Scheduled"),
                            ("partially_paid", "Partially paid"),
                            ("paid", "Paid"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="scheduled",
                        max_length=40,
                    ),
                ),
                ("bank_reference", models.CharField(blank=True, max_length=120)),
                ("note", models.TextField(blank=True)),
                (
                    "total_amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=14),
                ),
            ],
            options={
                "ordering": ["-batch_date", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="PaymentBatchLine",
            fields=[
                (
                    "id",
                    models.CharField(
                        default=inventory.models.payment_batch_line_id,
                        max_length=80,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("paid", models.BooleanField(default=False)),
                ("paid_date", models.DateField(blank=True, null=True)),
                (
                    "amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=14),
                ),
                (
                    "payment_batch",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="lines",
                        to="inventory.paymentbatch",
                    ),
                ),
                (
                    "purchase",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payment_batch_lines",
                        to="inventory.purchase",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
    ]
