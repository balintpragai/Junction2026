"""Tests for common.engine_client against a tiny fake engine on localhost."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from common.engine_client import RescoreFailed, rescore_and_wait

CREATED = "2026-11-14T12:00:00Z"


def job(status: str, **extra) -> dict:
    return {"id": "j1", "status": status, "created_at": CREATED, **extra}


@pytest.fixture
def engine():
    """Serves POST /jobs/rescore with the first response, then GET /jobs/j1 with the rest in turn."""
    responses: list[dict] = []
    seen: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def _reply(self):
            seen.append(f"{self.command} {self.path}")
            body = json.dumps(responses.pop(0)).encode()
            self.send_response(202 if self.command == "POST" else 200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        do_GET = do_POST = _reply

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}", responses, seen
    server.shutdown()


def test_polls_until_succeeded(engine):
    url, responses, seen = engine
    responses += [job("queued"), job("running"), job("succeeded", gaps_written=10, gaps_removed=0)]

    done = rescore_and_wait(url, sleep=lambda _: None)

    assert (done.status, done.gaps_written) == ("succeeded", 10)
    assert seen == ["POST /jobs/rescore", "GET /jobs/j1", "GET /jobs/j1"]


def test_partial_job_is_returned_not_raised(engine):
    url, responses, _ = engine
    failure = {"code": "3336", "error": "ZeroDivisionError: division by zero"}
    responses += [job("queued"), job("partial", gaps_written=9, failed_indicators=[failure])]

    done = rescore_and_wait(url, sleep=lambda _: None)

    assert done.status == "partial"
    assert [f.code for f in done.failed_indicators] == ["3336"]


def test_failed_job_raises_with_the_job(engine):
    url, responses, _ = engine
    responses += [job("queued"), job("failed", error="RuntimeError: boom")]

    with pytest.raises(RescoreFailed, match="boom") as info:
        rescore_and_wait(url, sleep=lambda _: None)
    assert info.value.job.status == "failed"


def test_times_out(engine):
    url, responses, _ = engine
    responses += [job("queued"), job("running"), job("running")]

    with pytest.raises(TimeoutError):
        rescore_and_wait(url, timeout_s=2, poll_interval_s=1, sleep=lambda _: None)
