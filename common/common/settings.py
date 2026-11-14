"""Service configuration, read from environment variables only.

The same images run locally, on the demo VM and on Verda; only the env changes.
See `.env.example` at the repo root for every variable.
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass, field, fields
from typing import Self


@dataclass(frozen=True)
class Settings:
    database_url: str | None = None
    engine_url: str | None = None
    narrative_url: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    llm_api_key: str | None = field(default=None, repr=False)

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> Self:
        """Read each field from the upper-case env var of the same name. Empty means unset."""
        return cls(**{f.name: env.get(f.name.upper()) or None for f in fields(cls)})

    def require(self, *names: str) -> Self:
        """Fail fast at startup if any of the named settings is missing."""
        missing = [n.upper() for n in names if getattr(self, n) is None]
        if missing:
            raise RuntimeError(f"Missing required environment variable(s): {', '.join(missing)}")
        return self
