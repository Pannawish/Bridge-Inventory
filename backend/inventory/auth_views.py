from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .access_control import has_activity_log_permission, has_user_access_admin_permission
from .audit import log_activity
from .models import ActivityLog


User = get_user_model()


class InventoryTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = str(request.data.get(User.USERNAME_FIELD) or "").strip()
            user = User.objects.filter(**{User.USERNAME_FIELD: username}).first()
            if user:
                log_activity(
                    request,
                    ActivityLog.ACTION_LOGIN,
                    user,
                    actor_user=user,
                    before={},
                    after={},
                    summary=f"{user.username} signed in.",
                )
        return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "groups": [{"id": group.id, "name": group.name} for group in user.groups.all()],
        "permissions": sorted(user.get_all_permissions()),
        "can_manage_users": has_user_access_admin_permission(user),
        "can_view_activity_log": has_activity_log_permission(user),
    })
