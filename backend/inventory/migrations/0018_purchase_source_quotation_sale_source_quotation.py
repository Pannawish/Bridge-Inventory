from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0017_backfill_quotation_item_suppliers"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchase",
            name="source_quotation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="derived_purchases",
                to="inventory.quotation",
            ),
        ),
        migrations.AddField(
            model_name="sale",
            name="source_quotation",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="derived_sales",
                to="inventory.quotation",
            ),
        ),
    ]
