"""Permission classes for inventory API access control."""

from django.conf import settings
from rest_framework.permissions import BasePermission, DjangoModelPermissions, SAFE_METHODS

from .access_control import has_activity_log_permission, has_user_access_admin_permission


class InventoryModelPermissions(DjangoModelPermissions):
    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }

    def has_permission(self, request, view):
        if not settings.INVENTORY_REQUIRE_AUTH:
            return True
        return super().has_permission(request, view)


class IsUserAccessAdmin(BasePermission):
    def has_permission(self, request, view):
        return has_user_access_admin_permission(request.user)


class CanViewActivityLog(BasePermission):
    def has_permission(self, request, view):
        if request.method not in SAFE_METHODS:
            return False
        return has_activity_log_permission(request.user)
