"""Number formatting and the number-check.

The number-check compares magnitudes only: units (`%`, `pp`, "percentage
points") and signs are words around a number, not part of it, so `5.7 pp`,
`5,7 %` and `-5.7` all match a deviation of -5.7. Every number in a Narrative
must match a number in the facts it was written from, exactly.
"""

import math
import re
from collections.abc import Iterable
from typing import Any

# A number is digits, optionally followed by one decimal separator (. or ,) and
# more digits. "21, 23" is two numbers; "2024." ends a sentence.
_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def format_number(x: float, language: str = "en") -> str:
    """At most two decimals, no trailing zeros; decimal comma in Finnish."""
    s = f"{abs(x) if x == 0 else x:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",") if language == "fi" else s


def extract_numbers(text: str) -> list[str]:
    return _NUMBER.findall(text)


def _to_float(token: str) -> float:
    return float(token.replace(",", "."))


def allowed_numbers(facts: Any) -> set[float]:
    """Every number in a facts structure: numeric values (as magnitudes) and
    numbers written inside strings."""
    found: set[float] = set()

    def walk(x: Any) -> None:
        if isinstance(x, bool) or x is None:
            return
        if isinstance(x, (int, float)):
            found.add(abs(float(x)))
        elif isinstance(x, str):
            found.update(_to_float(t) for t in extract_numbers(x))
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, Iterable):
            for v in x:
                walk(v)

    walk(facts)
    return found


def unverified_numbers(text: str, allowed: set[float]) -> list[str]:
    """Numbers in `text` that don't appear in `allowed`. Empty means the text passes."""
    return [
        t for t in extract_numbers(text)
        if not any(math.isclose(_to_float(t), a, rel_tol=0, abs_tol=1e-9) for a in allowed)
    ]
