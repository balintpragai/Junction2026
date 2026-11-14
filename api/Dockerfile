# Build from the repo root:  docker build --platform linux/amd64 -f api/Dockerfile -t reach-loop-api .
FROM python:3.12-slim

WORKDIR /srv
COPY common/ ./common/
COPY api/requirements.txt api/constraints.txt ./api/
RUN pip install --no-cache-dir -c api/constraints.txt ./common -r api/requirements.txt

COPY api/app/ ./api/app/
WORKDIR /srv/api

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
