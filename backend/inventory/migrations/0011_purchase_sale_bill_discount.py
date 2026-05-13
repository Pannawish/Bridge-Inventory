from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0010_remove_product_picture_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchase",
            name="bill_discount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name="sale",
            name="bill_discount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
    ]
