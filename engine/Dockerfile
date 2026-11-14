# Build from the repo root:  docker build --platform linux/amd64 -f engine/Dockerfile .
FROM python:3.12-slim

WORKDIR /srv
COPY common/ ./common/
COPY engine/requirements.txt ./engine/requirements.txt
RUN pip install --no-cache-dir ./common -r engine/requirements.txt

COPY engine/app/ ./engine/app/
WORKDIR /srv/engine

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
