"""Trigger a rescore by hand and wait for it.

    docker compose exec engine python -m app.rescore_now

`engine` publishes no port, so this runs inside its container and calls the
running service on localhost. Prints the final job status as JSON.
Exit code: 0 succeeded, 2 partial (see failed_indicators), 1 failed.
"""

import sys

from common.engine_client import RescoreFailed, rescore_and_wait


def main(engine_url: str = "http://localhost:8000") -> int:
    try:
        job = rescore_and_wait(engine_url)
    except RescoreFailed as e:
        print(e.job.model_dump_json(indent=2))
        return 1
    print(job.model_dump_json(indent=2))
    return 2 if job.status == "partial" else 0


if __name__ == "__main__":
    sys.exit(main())
