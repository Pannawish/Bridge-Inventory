"""Tests for the optional model wording used by inventory chat."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from .services.openai_chat import generate_openai_chat_response


@override_settings(OPENAI_API_KEY="test-key", OPENAI_MODEL="gpt-test")
class OpenAIChatServiceTests(SimpleTestCase):
    def test_uses_responses_api_to_explain_prepared_facts(self):
        client = MagicMock()
        client.responses.create.return_value = SimpleNamespace(
            output_text=(
                '{"answer":"Stock is below the reorder level.",'
                '"conclusion":"Restocking needs attention.",'
                '"highlights":["One product is below its reorder level.",'
                '"Review the incoming purchase."]}'
            )
        )

        with patch("openai.OpenAI", return_value=client) as mock_openai:
            response = generate_openai_chat_response(
                "Which item needs restocking?",
                {"title": "Restock priorities", "metrics": [{"label": "Low-stock items", "value": 1}]},
                "Low-stock items: 1.",
            )

        self.assertEqual(response["used_model"], "gpt-test")
        self.assertEqual(response["answer"], "Stock is below the reorder level.")
        self.assertEqual(response["conclusion"], "Restocking needs attention.")
        self.assertEqual(len(response["highlights"]), 2)
        mock_openai.assert_called_once_with(api_key="test-key", timeout=30.0)
        request = client.responses.create.call_args.kwargs
        self.assertEqual(request["model"], "gpt-test")
        self.assertIn("Low-stock items", request["input"][1]["content"])
        self.assertEqual(request["text"]["format"]["type"], "json_schema")
        client.chat.completions.create.assert_not_called()

    @override_settings(OPENAI_API_KEY="")
    def test_skips_openai_without_an_api_key(self):
        response = generate_openai_chat_response(
            "Which item needs restocking?",
            {"title": "Restock priorities"},
            "Low-stock items: 1.",
        )

        self.assertEqual(response["answer"], "")
        self.assertEqual(response["conclusion"], "")
        self.assertEqual(response["highlights"], [])
        self.assertEqual(response["used_model"], "local-summary")
