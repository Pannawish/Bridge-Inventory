from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q

from .models import (
    ActivityLog,
    BillingNote,
    Category,
    CreditNote,
    Customer,
    PaymentBatch,
    Product,
    ProductSupplier,
    Purchase,
    Quotation,
    Sale,
    Supplier,
)


ACTION_PREFIXES = ("view", "add", "change", "delete")

DOMAIN_MODELS = (
    Category,
    Supplier,
    Customer,
    Product,
    ProductSupplier,
    Purchase,
    Sale,
    Quotation,
    BillingNote,
    PaymentBatch,
    CreditNote,
)

PERMISSION_MODEL_GROUPS = (
    *DOMAIN_MODELS,
    ActivityLog,
    get_user_model(),
    Group,
)


ROLE_PERMISSION_RULES = {
    "Admin": {
        "all_models": (*DOMAIN_MODELS, ActivityLog, get_user_model(), Group),
        "actions": ACTION_PREFIXES,
    },
    "Manager": {
        "all_models": DOMAIN_MODELS,
        "actions": ACTION_PREFIXES,
    },
    "Sales": {
        "models": {
            Customer: ("view", "add", "change"),
            Product: ("view",),
            ProductSupplier: ("view",),
            Sale: ("view", "add", "change"),
            Quotation: ("view", "add", "change"),
            BillingNote: ("view", "add", "change"),
            CreditNote: ("view", "add", "change"),
        }
    },
    "Purchasing": {
        "models": {
            Supplier: ("view", "add", "change"),
            Product: ("view", "add", "change"),
            ProductSupplier: ("view", "add", "change"),
            Purchase: ("view", "add", "change"),
            PaymentBatch: ("view",),
            Quotation: ("view",),
        }
    },
    "Accounting": {
        "models": {
            Customer: ("view",),
            Supplier: ("view",),
            Purchase: ("view",),
            Sale: ("view",),
            BillingNote: ("view", "add", "change"),
            PaymentBatch: ("view", "add", "change"),
            CreditNote: ("view", "add", "change"),
        }
    },
    "Viewer": {
        "all_models": DOMAIN_MODELS,
        "actions": ("view",),
    },
}


def get_permissions_for_model(model, actions=ACTION_PREFIXES):
    content_type = ContentType.objects.get_for_model(model)
    codenames = [f"{action}_{model._meta.model_name}" for action in actions]
    return Permission.objects.filter(content_type=content_type, codename__in=codenames)


def get_role_permissions(role_name):
    rule = ROLE_PERMISSION_RULES.get(role_name, {})
    permissions = []

    for model in rule.get("all_models", ()):
        permissions.extend(get_permissions_for_model(model, rule.get("actions", ACTION_PREFIXES)))

    for model, actions in rule.get("models", {}).items():
        permissions.extend(get_permissions_for_model(model, actions))

    return list({permission.id: permission for permission in permissions}.values())


def ensure_default_inventory_groups():
    for role_name in ROLE_PERMISSION_RULES:
        group, created = Group.objects.get_or_create(name=role_name)
        if created:
            group.permissions.set(get_role_permissions(role_name))


def get_managed_permission_options():
    content_types = [
        ContentType.objects.get_for_model(model)
        for model in PERMISSION_MODEL_GROUPS
    ]
    action_filter = Q()
    for action in ACTION_PREFIXES:
        action_filter |= Q(codename__startswith=f"{action}_")

    return (
        Permission.objects.filter(content_type__in=content_types)
        .filter(action_filter)
        .select_related("content_type")
        .order_by("content_type__app_label", "content_type__model", "codename")
    )


def has_user_access_admin_permission(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    return user.has_perm("auth.view_user") or user.has_perm("auth.change_user")


def has_activity_log_permission(user):
    if not user or not user.is_authenticated:
        return False
    if has_user_access_admin_permission(user):
        return True
    return user.has_perm("inventory.view_activitylog")
