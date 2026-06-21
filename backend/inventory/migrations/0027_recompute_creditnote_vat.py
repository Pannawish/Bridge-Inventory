from decimal import Decimal, ROUND_HALF_UP

from django.db import migrations

VAT_RATE = Decimal("0.07")


def recompute_vat(apps, schema_editor):
    """Backfill VAT on existing credit notes so they reduce a billing note by the
    same VAT-inclusive value the source sale was charged (mirrors the sale's
    vat_mode), instead of just the bare line price."""
    CreditNote = apps.get_model("inventory", "CreditNote")
    for credit_note in CreditNote.objects.all().iterator():
        line_total = Decimal("0")
        for line in credit_note.lines.all():
            line_total += line.amount or Decimal("0")

        vat_mode = getattr(credit_note.sale, "vat_mode", "") or "not_included"
        if vat_mode == "included":
            subtotal = (line_total / (Decimal("1") + VAT_RATE)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            vat = line_total - subtotal
        elif vat_mode == "not_included":
            subtotal = line_total
            vat = (line_total * VAT_RATE).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            subtotal = line_total
            vat = Decimal("0")

        credit_note.vat_mode = vat_mode
        credit_note.total_before_vat = subtotal
        credit_note.vat_amount = vat
        credit_note.total_amount = subtotal + vat
        credit_note.save(
            update_fields=[
                "vat_mode",
                "total_before_vat",
                "vat_amount",
                "total_amount",
            ]
        )


def noop(apps, schema_editor):
    # Irreversible-but-harmless: leaving the recomputed values in place is fine.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0026_creditnote_total_before_vat_creditnote_vat_amount_and_more"),
    ]

    operations = [migrations.RunPython(recompute_vat, noop)]
