import os

# app.main requires these at import. Tests never connect: the job runner is replaced.
os.environ.setdefault("DATABASE_URL", "postgresql://unused@localhost/unused")
os.environ.setdefault("NARRATIVE_URL", "http://unused")
