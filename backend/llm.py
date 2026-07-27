"""Drop-in replacement for `emergentintegrations.llm.chat`.

Emergent billed LLM calls through their own proxy using EMERGENT_LLM_KEY, and
the `emergentintegrations` package is only installable from Emergent's private
index. Off-platform we talk to an OpenAI-compatible API directly, keeping the
exact same call shape the app already uses:

    chat = LlmChat(api_key=..., session_id=..., system_message=...)
    chat = chat.with_model("openai", "gpt-5.4")
    text = await chat.send_message(UserMessage(text="..."))

Provider is configurable so this also works against Anthropic, Groq, OpenRouter,
or any other OpenAI-compatible endpoint via LLM_BASE_URL / LLM_MODEL.
"""
import logging
import os
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")
DEFAULT_MODEL = os.environ.get("LLM_MODEL", "gpt-5.4")
REQUEST_TIMEOUT = float(os.environ.get("LLM_TIMEOUT_SECONDS", "60"))


@dataclass
class UserMessage:
    """Matches the emergentintegrations signature: UserMessage(text=...)."""
    text: str


class LlmChat:
    def __init__(
        self,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        system_message: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.session_id = session_id
        self.system_message = system_message
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.model = DEFAULT_MODEL

    def with_model(self, provider: str, model: str) -> "LlmChat":
        """`provider` is accepted for call-site compatibility.

        The endpoint is determined by LLM_BASE_URL, so the provider argument is
        informational only. An explicit LLM_MODEL env var always wins, which
        lets you switch models without touching code.
        """
        self.model = os.environ.get("LLM_MODEL") or model
        return self

    async def send_message(self, message: UserMessage) -> str:
        if not self.api_key:
            raise RuntimeError("No LLM API key configured (set OPENAI_API_KEY)")

        messages = []
        if self.system_message:
            messages.append({"role": "system", "content": self.system_message})
        messages.append({"role": "user", "content": message.text})

        payload = {"model": self.model, "messages": messages}

        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if resp.status_code >= 400:
            detail = resp.text[:400]
            logger.error(f"[LLM] {resp.status_code} from {self.base_url}: {detail}")
            raise RuntimeError(f"LLM request failed ({resp.status_code}): {detail}")

        data = resp.json()
        try:
            return (data["choices"][0]["message"]["content"] or "").strip()
        except (KeyError, IndexError) as e:
            logger.error(f"[LLM] Unexpected response shape: {str(data)[:400]}")
            raise RuntimeError(f"Unexpected LLM response: {e}")
