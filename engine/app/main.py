"""`engine` (internal): owns scoring and the rescore job.

Stub for the compose skeleton. The scoring function arrives in #8 and
`POST /jobs/rescore` in #13.
"""

from fastapi import FastAPI

from common.models import Health
from common.settings import Settings

settings = Settings.from_env().require("database_url", "narrative_url")

app = FastAPI(title="Reach Loop engine", version="0.1.0")


@app.get("/health", response_model=Health)
def health() -> Health:
    return Health(status="ok")
