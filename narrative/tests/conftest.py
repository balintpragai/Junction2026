import pytest
from fastapi.testclient import TestClient

from app.main import app, get_llm
from common.models import Gap, NarrativeRequest, PeerValue

LLM_ENV = ("LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY")


def helsinki_gap() -> Gap:
    """The Helsinki breast-screening 2024 case: 74.3 against a Target of 80."""
    return Gap(
        region_code="helsinki",
        indicator_code="3621",
        year=2024,
        value=74.3,
        reference_kind="target",
        reference_value=80.0,
        deviation=-5.7,
        direction="below",
        severity="act",
        rank=21,
        n_regions=23,
        peer_values=[PeerValue(region_code="helsinki", value=74.3), PeerValue(region_code="lappi", value=79.4)],
        trend_5y=-6.3,
    )


@pytest.fixture
def helsinki_request() -> NarrativeRequest:
    return NarrativeRequest(
        region_name="Helsinki",
        indicator_name="Breast cancer screening attendance",
        indicator_name_fi="Rintasyöpäseulontaan osallistuminen",
        unit="%",
        gap=helsinki_gap(),
        action_text="Raise screening participation through targeted invitations.",
        data_quality_note=None,
    )


class FakeLLM:
    """Returns a fixed reply and records the messages it was sent."""

    def __init__(self, reply: str | Exception) -> None:
        self.reply = reply
        self.calls: list[list[dict[str, str]]] = []

    def complete(self, messages: list[dict[str, str]]) -> str:
        self.calls.append(messages)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture
def no_llm_env(monkeypatch):
    for name in LLM_ENV:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def with_llm(client):
    """Call with a reply; installs a FakeLLM as the service's LLM and returns it."""

    def install(reply: str | Exception) -> FakeLLM:
        fake = FakeLLM(reply)
        app.dependency_overrides[get_llm] = lambda: fake
        return fake

    return install
