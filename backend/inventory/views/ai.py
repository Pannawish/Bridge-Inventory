"""AI chat and report endpoints.

These endpoints are intentionally thin: services prepare the business context
and report payloads so chat/report behavior can be tested without HTTP setup.
"""

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..ai_reports import generate_ai_report
from ..services import answer_inventory_question


@api_view(["POST"])
def chat(request):
    question = (request.data.get("question") or "").strip()

    if not question:
        return Response({"error": "Question is required."}, status=status.HTTP_400_BAD_REQUEST)

    return Response(answer_inventory_question(question, request))


@api_view(["POST"])
def ai_report(request):
    return Response(generate_ai_report(request.data))

__all__ = ["ai_report", "chat"]
