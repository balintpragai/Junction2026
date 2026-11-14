"""`seed` (one-shot): create the schema, load data, ask `engine` to score, exit.

Stub for the compose skeleton: it only proves it can reach `db` and `engine`.
Schema and data loading arrive in #7; triggering the rescore in #13.
Run with `python -m seed`.
"""

import sys
import urllib.request

from common.db import ping
from common.settings import Settings


def main() -> int:
    settings = Settings.from_env().require("database_url", "engine_url")
    ping(settings.database_url)
    print("seed: db reachable")
    with urllib.request.urlopen(f"{settings.engine_url}/health", timeout=5) as r:
        print(f"seed: engine /health -> {r.status}")
    print("seed: stub done (schema and data load come in #7)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
