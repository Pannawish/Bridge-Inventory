from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0003_quotation"),
    ]

    operations = [
        # Customer / Supplier: add term_type, change billing_note_date to short text
        migrations.AddField(
            model_name="customer",
            name="term_type",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="supplier",
            name="term_type",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AlterField(
            model_name="customer",
            name="billing_note_date",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AlterField(
            model_name="supplier",
            name="billing_note_date",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        # Purchase: add payment_term_type, payment_term_days, payment_date
        migrations.AddField(
            model_name="purchase",
            name="payment_term_type",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="purchase",
            name="payment_term_days",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="purchase",
            name="payment_date",
            field=models.DateField(blank=True, null=True),
        ),
        # Sale: replace payment_timing/payment_received_date with payment_term_type/payment_term_days/payment_date
        migrations.AddField(
            model_name="sale",
            name="payment_term_type",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="sale",
            name="payment_term_days",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="sale",
            name="payment_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.RemoveField(
            model_name="sale",
            name="payment_timing",
        ),
        migrations.RemoveField(
            model_name="sale",
            name="payment_received_date",
        ),
    ]
