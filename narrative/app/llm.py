"""OpenAI-compatible chat client, configured only through LLM_* env vars.

Works with any `/chat/completions` endpoint: OpenAI, Gemini's OpenAI-compatible
API, vLLM, Ollama, Verda. `LLM_API_KEY` is optional for self-hosted endpoints.
"""

from typing import Protocol

import httpx

from common.settings import Settings

TIMEOUT_SECONDS = 20.0


class ChatClient(Protocol):
    def complete(self, messages: list[dict[str, str]]) -> str: ...


class OpenAICompatibleClient:
    def __init__(self, base_url: str, model: str, api_key: str | None) -> None:
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.model = model
        self.headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    def complete(self, messages: list[dict[str, str]]) -> str:
        r = httpx.post(
            self.url,
            headers=self.headers,
            json={"model": self.model, "messages": messages, "temperature": 0},
            timeout=TIMEOUT_SECONDS,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


def client_from_env() -> ChatClient | None:
    """None when no LLM is configured: the service then returns Template sentences only."""
    s = Settings.from_env()
    if not (s.llm_base_url and s.llm_model):
        return None
    return OpenAICompatibleClient(s.llm_base_url, s.llm_model, s.llm_api_key)
