"""User access and activity log views.

Only the managed inventory permission set is exposed here. These viewsets also
write audit logs around user and role changes because access changes are part of
the operational history.
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..access_control import ensure_default_inventory_groups, get_managed_permission_options
from ..audit import log_activity, serialize_model_instance
from ..models import ActivityLog
from ..permissions import CanViewActivityLog, IsUserAccessAdmin
from ..serializers import (
    ActivityLogSerializer,
    AdminRoleSerializer,
    AdminUserSerializer,
    PermissionOptionSerializer,
)


User = get_user_model()


def serialize_admin_user_access(user):
    snapshot = serialize_model_instance(user)
    if user.pk:
        snapshot["group_ids"] = list(user.groups.order_by("id").values_list("id", flat=True))
        snapshot["permission_ids"] = list(
            user.user_permissions.order_by("id").values_list("id", flat=True)
        )
    return snapshot


def serialize_admin_role_access(group):
    snapshot = serialize_model_instance(group)
    if group.pk:
        snapshot["permission_ids"] = list(
            group.permissions.order_by("id").values_list("id", flat=True)
        )
    return snapshot

class AdminUserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsUserAccessAdmin]
    lookup_value_regex = "[^/]+"

    def get_queryset(self):
        ensure_default_inventory_groups()
        queryset = User.objects.prefetch_related("groups", "user_permissions").order_by(
            "username"
        )
        params = self.request.query_params

        search_query = (params.get("search") or params.get("q") or "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )

        active = (params.get("active") or "").strip().lower()
        if active in {"true", "1", "yes"}:
            queryset = queryset.filter(is_active=True)
        elif active in {"false", "0", "no"}:
            queryset = queryset.filter(is_active=False)

        role_id = (params.get("role") or "").strip()
        if role_id:
            queryset = queryset.filter(groups__id=role_id)

        return queryset.distinct()

    def perform_create(self, serializer):
        user = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_CREATE,
            user,
            before={},
            after=serialize_admin_user_access(user),
        )

    def perform_update(self, serializer):
        before = serialize_admin_user_access(serializer.instance)
        user = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_UPDATE,
            user,
            before=before,
            after=serialize_admin_user_access(user),
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {"error": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        before = serialize_admin_user_access(instance)
        with transaction.atomic():
            instance.delete()
            log_activity(
                self.request,
                ActivityLog.ACTION_DELETE,
                instance,
                before=before,
                after={},
            )


class AdminRoleViewSet(viewsets.ModelViewSet):
    serializer_class = AdminRoleSerializer
    permission_classes = [IsUserAccessAdmin]
    queryset = Group.objects.prefetch_related("permissions__content_type").order_by("name")

    def get_queryset(self):
        ensure_default_inventory_groups()
        queryset = super().get_queryset()
        search_query = (self.request.query_params.get("search") or "").strip()
        if search_query:
            queryset = queryset.filter(name__icontains=search_query)
        return queryset

    def perform_create(self, serializer):
        role = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_CREATE,
            role,
            before={},
            after=serialize_admin_role_access(role),
        )

    def perform_update(self, serializer):
        before = serialize_admin_role_access(serializer.instance)
        role = serializer.save()
        log_activity(
            self.request,
            ActivityLog.ACTION_UPDATE,
            role,
            before=before,
            after=serialize_admin_role_access(role),
        )

    def perform_destroy(self, instance):
        before = serialize_admin_role_access(instance)
        with transaction.atomic():
            instance.delete()
            log_activity(
                self.request,
                ActivityLog.ACTION_DELETE,
                instance,
                before=before,
                after={},
            )

    @action(detail=False, methods=["get"], url_path="permission-options")
    def permission_options(self, request):
        permissions = get_managed_permission_options()
        serializer = PermissionOptionSerializer(permissions, many=True)
        return Response(serializer.data)


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivityLogSerializer
    permission_classes = [CanViewActivityLog]
    queryset = ActivityLog.objects.select_related("user").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        search_query = (params.get("search") or params.get("q") or "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(actor_username__icontains=search_query)
                | Q(object_type__icontains=search_query)
                | Q(object_id__icontains=search_query)
                | Q(object_repr__icontains=search_query)
                | Q(summary__icontains=search_query)
            )

        action_value = (params.get("action") or "").strip()
        if action_value:
            queryset = queryset.filter(action=action_value)

        user_id = (params.get("user") or "").strip()
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        object_type = (params.get("object_type") or "").strip()
        if object_type:
            queryset = queryset.filter(object_type=object_type)

        date_from = (params.get("date_from") or params.get("from") or "").strip()
        date_to = (params.get("date_to") or params.get("to") or "").strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset

__all__ = [
    "ActivityLogViewSet",
    "AdminRoleViewSet",
    "AdminUserViewSet",
    "serialize_admin_role_access",
    "serialize_admin_user_access",
]
