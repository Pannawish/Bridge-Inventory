from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0013_creditnote_creditnoteline_creditnote_inv_cn_date_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(
                fields=["is_active", "product_name"],
                name="inv_prod_active_name",
            ),
        ),
    ]
