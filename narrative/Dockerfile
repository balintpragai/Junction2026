# Build from the repo root:  docker build --platform linux/amd64 -f narrative/Dockerfile .
FROM python:3.12-slim

WORKDIR /srv
COPY common/ ./common/
COPY narrative/requirements.txt ./narrative/requirements.txt
RUN pip install --no-cache-dir ./common -r narrative/requirements.txt

COPY narrative/app/ ./narrative/app/
WORKDIR /srv/narrative

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
