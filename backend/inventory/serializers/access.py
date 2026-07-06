"""User access and activity log serializers."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from ..models import ActivityLog


User = get_user_model()


class PermissionOptionSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    action = serializers.SerializerMethodField()
    module_key = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "codename", "name", "app_label", "model", "action", "module_key"]

    def get_action(self, permission):
        return permission.codename.split("_", 1)[0]

    def get_module_key(self, permission):
        return permission.content_type.model


class AdminRoleSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions",
        many=True,
        queryset=Permission.objects.all(),
        required=False,
    )
    permissions = PermissionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ["id", "name", "permission_ids", "permissions"]
        extra_kwargs = {
            "name": {"allow_blank": False},
        }

    def validate_permission_ids(self, permissions):
        from ..access_control import get_managed_permission_options

        allowed_ids = set(get_managed_permission_options().values_list("id", flat=True))
        selected_ids = {permission.id for permission in permissions}
        disallowed_ids = selected_ids - allowed_ids
        if disallowed_ids:
            raise serializers.ValidationError("One or more permissions cannot be managed here.")
        return permissions

    def create(self, validated_data):
        permissions = validated_data.pop("permissions", [])
        group = Group.objects.create(**validated_data)
        group.permissions.set(permissions)
        return group

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permissions", serializers.empty)
        instance.name = validated_data.get("name", instance.name)
        instance.save()
        if permissions is not serializers.empty:
            instance.permissions.set(permissions)
        return instance


class AdminUserSerializer(serializers.ModelSerializer):
    role_ids = serializers.PrimaryKeyRelatedField(
        source="groups",
        many=True,
        queryset=Group.objects.all(),
        required=False,
    )
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "last_login",
            "date_joined",
            "role_ids",
            "roles",
            "permissions",
            "password",
        ]
        read_only_fields = ["id", "last_login", "date_joined", "permissions", "roles"]
        extra_kwargs = {
            "email": {"required": False, "allow_blank": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
            "is_active": {"required": False},
            "is_staff": {"required": False},
            "is_superuser": {"required": False},
        }

    def get_roles(self, user):
        return [{"id": group.id, "name": group.name} for group in user.groups.all()]

    def get_permissions(self, user):
        return sorted(user.get_all_permissions())

    def validate_password(self, value):
        if value:
            validate_password(value, self.instance)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        current_user = getattr(request, "user", None)

        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "Password is required."})

        is_superuser_value = attrs.get("is_superuser")
        if (
            is_superuser_value is not None
            and is_superuser_value != getattr(self.instance, "is_superuser", False)
            and not getattr(current_user, "is_superuser", False)
        ):
            raise serializers.ValidationError(
                {"is_superuser": "Only a superuser can change superuser access."}
            )

        if self.instance is not None and current_user and self.instance.id == current_user.id:
            if attrs.get("is_active") is False:
                raise serializers.ValidationError(
                    {"is_active": "You cannot deactivate your own account."}
                )
            if attrs.get("is_staff") is False and current_user.is_staff:
                raise serializers.ValidationError(
                    {"is_staff": "You cannot remove your own admin access."}
                )

        return attrs

    def create(self, validated_data):
        groups = validated_data.pop("groups", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set(groups)
        return user

    def update(self, instance, validated_data):
        groups = validated_data.pop("groups", serializers.empty)
        password = validated_data.pop("password", "")

        for field, value in validated_data.items():
            setattr(instance, field, value)
        if password:
            instance.set_password(password)
        instance.save()

        if groups is not serializers.empty:
            instance.groups.set(groups)

        return instance


class ActivityLogUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


class ActivityLogSerializer(serializers.ModelSerializer):
    user = ActivityLogUserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "user",
            "actor_username",
            "action",
            "object_type",
            "object_id",
            "object_repr",
            "summary",
            "changes",
            "ip_address",
            "user_agent",
            "created_at",
        ]

__all__ = [
    "ActivityLogSerializer",
    "ActivityLogUserSerializer",
    "AdminRoleSerializer",
    "AdminUserSerializer",
    "PermissionOptionSerializer",
]
