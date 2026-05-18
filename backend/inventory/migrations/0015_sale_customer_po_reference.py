from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0014_product_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="customer_po_reference",
            field=models.CharField(blank=True, max_length=120),
        ),
    ]
