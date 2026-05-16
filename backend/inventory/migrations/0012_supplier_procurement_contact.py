from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0011_purchase_sale_bill_discount"),
    ]

    operations = [
        migrations.AddField(
            model_name="supplier",
            name="procurement_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="supplier",
            name="procurement_tel",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]
