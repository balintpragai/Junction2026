# Build from the repo root:  docker build --platform linux/amd64 -f seed/Dockerfile .
FROM python:3.12-slim

WORKDIR /srv
COPY common/ ./common/
RUN pip install --no-cache-dir ./common

COPY seed/seed/ ./seed/seed/
WORKDIR /srv/seed

CMD ["python", "-m", "seed"]
