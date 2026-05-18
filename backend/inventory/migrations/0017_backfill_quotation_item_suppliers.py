from django.db import migrations


def backfill_supplier_options(apps, schema_editor):
    """Keep legacy quotation cost data: each item with a cost_price becomes one
    QuotationItemSupplier row sourced from the quotation's (old) single supplier."""
    QuotationItem = apps.get_model("inventory", "QuotationItem")
    QuotationItemSupplier = apps.get_model("inventory", "QuotationItemSupplier")

    rows = []
    for item in QuotationItem.objects.select_related("quotation").all():
        if item.cost_price is None:
            continue
        quotation = item.quotation
        rows.append(
            QuotationItemSupplier(
                quotation_item=item,
                supplier_id=quotation.supplier_id,
                supplier_name=quotation.supplier_name or "",
                cost_price=item.cost_price,
                position=0,
            )
        )

    QuotationItemSupplier.objects.bulk_create(rows)


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0016_saleitem_supplier_saleitem_supplier_name_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_supplier_options, migrations.RunPython.noop),
    ]
