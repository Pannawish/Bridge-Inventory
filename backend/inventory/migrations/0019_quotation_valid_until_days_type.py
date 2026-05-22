from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0018_purchase_source_quotation_sale_source_quotation"),
    ]

    operations = [
        migrations.AddField(
            model_name="quotation",
            name="valid_until_days",
            field=models.IntegerField(blank=True, default=30, null=True),
        ),
        migrations.AddField(
            model_name="quotation",
            name="valid_until_day_type",
            field=models.CharField(blank=True, default="calendar", max_length=20),
        ),
    ]
