"""`narrative` (internal): the only component that talks to an LLM.

Stub for the compose skeleton. `POST /narrative`, the number check and the
Template sentence arrive in #9. LLM_* settings are optional: without them the
service will produce Template sentences only.
"""

from fastapi import FastAPI

from common.models import Health
from common.settings import Settings

settings = Settings.from_env()

app = FastAPI(title="Reach Loop narrative", version="0.1.0")


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")
