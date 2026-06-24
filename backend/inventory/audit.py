import logging
from datetime import date, datetime
from decimal import Decimal

from django.db import models, transaction

from .models import ActivityLog


logger = logging.getLogger(__name__)

SENSITIVE_FIELD_NAMES = {
    "password",
    "token",
    "refresh",
    "access",
    "secret",
}


def _truncate(value, max_length):
    value = str(value or "")
    return value[:max_length]


def _json_safe(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    return value


def _is_sensitive_field(field_name):
    lowered = field_name.lower()
    return any(token in lowered for token in SENSITIVE_FIELD_NAMES)


def serialize_model_instance(instance):
    if instance is None:
        return {}

    snapshot = {}
    for field in instance._meta.concrete_fields:
        field_name = field.name
        if _is_sensitive_field(field_name):
            continue

        if isinstance(field, models.ForeignKey):
            value = getattr(instance, field.attname)
            snapshot[field.attname] = _json_safe(value)
            continue

        value = getattr(instance, field_name)
        if isinstance(field, models.FileField):
            value = value.name if value else ""
        snapshot[field_name] = _json_safe(value)

    return snapshot


def build_change_set(before, after):
    before = before or {}
    after = after or {}
    changes = {}

    for key in sorted(set(before) | set(after)):
        if _is_sensitive_field(key):
            continue
        old_value = before.get(key)
        new_value = after.get(key)
        if old_value != new_value:
            changes[key] = {"before": old_value, "after": new_value}

    return changes


def get_client_ip(request):
    if request is None:
        return None

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip() or None

    return request.META.get("REMOTE_ADDR") or None


def get_actor_user(request, actor_user=None):
    if actor_user is not None:
        return actor_user
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def get_object_label(instance):
    if instance is None:
        return ""
    return instance._meta.label


def build_activity_summary(action, instance, changes=None):
    object_label = get_object_label(instance)
    object_name = str(instance or "").strip() or getattr(instance, "pk", "")
    readable_name = object_label.split(".")[-1] if object_label else "Record"

    if action == ActivityLog.ACTION_LOGIN:
        return f"{object_name} signed in."

    if action == ActivityLog.ACTION_UPDATE and changes and "status" in changes:
        before = changes["status"].get("before") or ""
        after = changes["status"].get("after") or ""
        return f"Updated {readable_name} {object_name} status from {before} to {after}."

    action_label = {
        ActivityLog.ACTION_CREATE: "Created",
        ActivityLog.ACTION_UPDATE: "Updated",
        ActivityLog.ACTION_DELETE: "Deleted",
    }.get(action, action.title())
    return f"{action_label} {readable_name} {object_name}."


def log_activity(
    request,
    action,
    instance,
    before=None,
    after=None,
    actor_user=None,
    summary="",
):
    if instance is None or isinstance(instance, ActivityLog):
        return

    actor = get_actor_user(request, actor_user=actor_user)
    before_snapshot = serialize_model_instance(instance) if before is None and action != ActivityLog.ACTION_CREATE else (before or {})
    after_snapshot = serialize_model_instance(instance) if after is None and action != ActivityLog.ACTION_DELETE else (after or {})
    changes = build_change_set(before_snapshot, after_snapshot)

    object_id = getattr(instance, "pk", "")
    log_data = {
        "user": actor,
        "actor_username": _truncate(getattr(actor, "username", "") if actor else "", 150),
        "action": action,
        "object_type": _truncate(get_object_label(instance), 120),
        "object_id": _truncate(object_id, 120),
        "object_repr": _truncate(str(instance), 255),
        "summary": summary or build_activity_summary(action, instance, changes),
        "changes": changes,
        "ip_address": get_client_ip(request),
        "user_agent": _truncate(getattr(request, "META", {}).get("HTTP_USER_AGENT", ""), 255),
    }

    def create_log_entry():
        try:
            ActivityLog.objects.create(**log_data)
        except Exception:
            logger.exception("Failed to create activity log entry.")

    transaction.on_commit(create_log_entry)
