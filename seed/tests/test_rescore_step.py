"""seed's last step: a rescore problem is a warning, never an error that stops the stack (#13)."""

import urllib.error
from datetime import UTC, datetime

import pytest

from common import engine_client
from common.models import IndicatorFailure, RescoreJob
from seed import __main__ as seed_main

NOW = datetime(2026, 11, 14, tzinfo=UTC)


def job(status: str, **extra) -> RescoreJob:
    return RescoreJob(id="j1", status=status, created_at=NOW, **extra)


def raising(exc: Exception):
    def fake(_url):
        raise exc
    return fake


@pytest.mark.parametrize(
    ("fake", "expected"),
    [
        (raising(engine_client.RescoreFailed(job("failed", error="boom"))), "rescore failed; previous Gaps kept"),
        (raising(TimeoutError("still running")), "rescore did not finish (TimeoutError"),
        (raising(urllib.error.URLError("connection refused")), "rescore did not finish (URLError"),
        (lambda _url: job("partial", gaps_written=9, gaps_removed=0,
                          failed_indicators=[IndicatorFailure(code="3336", error="x")]), "rescore partial: 1 indicator(s)"),
    ],
    ids=["failed", "timeout", "engine-unreachable", "partial"],
)
def test_rescore_problems_warn_and_do_not_raise(monkeypatch, capsys, fake, expected):
    monkeypatch.setattr(engine_client, "rescore_and_wait", fake)

    seed_main.rescore("http://engine")  # must not raise: main() then returns 0

    err = capsys.readouterr().err
    assert f"seed: WARNING: {expected}" in err
    assert "app.rescore_now" in err


def test_success_prints_no_warning(monkeypatch, capsys):
    monkeypatch.setattr(engine_client, "rescore_and_wait", lambda _url: job("succeeded", gaps_written=1933, gaps_removed=0))

    seed_main.rescore("http://engine")

    out = capsys.readouterr()
    assert "succeeded, 1933 Gaps written" in out.out
    assert out.err == ""
