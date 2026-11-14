"""`narrative` (internal): the only component that talks to an LLM.

`POST /narrative` turns one Gap into a Narrative that never shows an
unverified number: LLM output passes the number-check or is replaced by a
Template sentence. With no LLM configured, or for Finnish, it always returns
the Template sentence.
"""

import logging
from typing import Annotated

from fastapi import Depends, FastAPI

from common.models import Health, NarrativeConfig, NarrativeRequest, NarrativeResult
from common.settings import Settings

from . import prompt
from .llm import ChatClient, client_from_env
from .numbers import allowed_numbers, unverified_numbers
from common.template import template_sentence

log = logging.getLogger("narrative")

app = FastAPI(title="Reach Loop narrative", version="0.1.0")


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")


@app.get("/config", response_model=NarrativeConfig)
def config() -> NarrativeConfig:
    """The prompt version and model a request would use now. `engine` keys its cache on these."""
    s = Settings.from_env()
    model = s.llm_model if (s.llm_base_url and s.llm_model) else ""
    return NarrativeConfig(prompt_version=prompt.PROMPT_VERSION, model=model)


def get_llm() -> ChatClient | None:
    return client_from_env()


@app.post("/narrative", response_model=NarrativeResult)
def narrative(req: NarrativeRequest, llm: Annotated[ChatClient | None, Depends(get_llm)]) -> NarrativeResult:
    allowed = allowed_numbers(prompt.facts(req))
    rejected: list[str] = []

    if llm is not None and req.language == "en":
        try:
            text = llm.complete(prompt.messages(req))
        except Exception as e:  # network, auth, bad payload: never fail the caller
            log.warning("LLM call failed, using Template sentence: %s", e)
        else:
            rejected = unverified_numbers(text, allowed)
            too_long = len(text.split()) > prompt.MAX_WORDS
            if text and not rejected and not too_long:
                return _result(req, text, "llm", allowed)
            log.warning("LLM output discarded (unverified numbers=%s, words=%d)", rejected, len(text.split()))

    return _result(req, template_sentence(req), "template", allowed, rejected)


def _result(req: NarrativeRequest, text: str, source: str, allowed: set[float], rejected: list[str] | None = None) -> NarrativeResult:
    return NarrativeResult(
        text=text,
        source=source,
        language=req.language,
        numbers_checked=not unverified_numbers(text, allowed),
        prompt_version=prompt.PROMPT_VERSION,
        rejected_numbers=rejected or [],
    )
