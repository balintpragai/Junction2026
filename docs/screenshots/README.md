# `docs/screenshots/`

Proof images referenced from pull requests and issues. Committed because a PR
description needs a durable URL, and an image pasted into a GitHub comment is
not stored with the repo.

| File | What it shows |
|---|---|
| `decision-map-desktop-1440.png` | The Decision Map at 1440×900, served by the real `api` |
| `decision-map-phone-390.png` | The same page at 390×844: one column, no horizontal scroll |

Both were captured with Chromium at a device scale factor of 2, against
`docker compose`'s contract (`API_URL` pointing at `api`). Regenerate by loading
the page at those viewport sizes; there is no script, because this is evidence
for one review rather than a build artifact.
