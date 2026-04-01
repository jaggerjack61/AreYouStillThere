FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

RUN python - <<'PY'
from pathlib import Path

source = Path('requirements.txt').read_text(encoding='utf-16')
Path('requirements.docker.txt').write_text(source, encoding='utf-8')
PY

RUN python -m pip install --upgrade pip \
    && pip install -r requirements.docker.txt gunicorn "psycopg[binary]"

COPY . .

RUN useradd --create-home appuser \
    && mkdir -p /app/staticfiles \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=5 \
    CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8000/health/', timeout=5)"

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "2", "--timeout", "60", "config.wsgi:application"]
