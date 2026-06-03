from django.db import migrations


# Map the legacy "debit" payment/term keyword to the new canonical "cash"
# keyword. Stored as a language-neutral keyword; the UI/printable areas
# translate "cash" -> "Cash" / "เงินสด" via i18n.
FIELD_MAP = [
    ("Purchase", "payment_term_type"),
    ("Sale", "payment_term_type"),
    ("Quotation", "payment_term_type"),
    ("Customer", "term_type"),
    ("Supplier", "term_type"),
]


def debit_to_cash(apps, schema_editor):
    for model_name, field in FIELD_MAP:
        model = apps.get_model("inventory", model_name)
        model.objects.filter(**{field: "debit"}).update(**{field: "cash"})


def cash_to_debit(apps, schema_editor):
    for model_name, field in FIELD_MAP:
        model = apps.get_model("inventory", model_name)
        model.objects.filter(**{field: "cash"}).update(**{field: "debit"})


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0023_add_shipping_date_to_quotation"),
    ]

    operations = [
        migrations.RunPython(debit_to_cash, cash_to_debit),
    ]
