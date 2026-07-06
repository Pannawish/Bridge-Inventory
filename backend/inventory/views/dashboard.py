"""Dashboard API endpoints."""

from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..services import build_dashboard_overview, build_dashboard_segment, build_dashboard_summary


@api_view(["GET"])
def dashboard(request):
    data = build_dashboard_summary(request)
    data["overview"] = build_dashboard_overview()
    return Response(data)


@api_view(["GET"])
def dashboard_segment(request):
    segment = (request.query_params.get("segment") or "").strip()
    period = (request.query_params.get("period") or "").strip()
    result = build_dashboard_segment(segment, period)
    if result is None:
        return Response({"detail": "Unknown dashboard segment."}, status=400)
    return Response(result)

__all__ = ["dashboard", "dashboard_segment"]
