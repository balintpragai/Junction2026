# Build from the repo root:  docker build --platform linux/amd64 -f seed/Dockerfile .
FROM python:3.12-slim

WORKDIR /srv
COPY common/ ./common/
RUN pip install --no-cache-dir ./common

# Schema and data, at the same paths as in the repo (seed resolves them from /srv).
COPY db/ ./db/
COPY data/raw/sotkanet_regions.json ./data/raw/
COPY data/curated/ ./data/curated/
COPY data/processed/ ./data/processed/

COPY seed/seed/ ./seed/seed/
WORKDIR /srv/seed

CMD ["python", "-m", "seed"]
