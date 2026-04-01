# AreYouStillThere

AreYouStillThere is a full-stack service monitoring application. It lets you register services, run HTTP/content checks, track incidents and uptime, and send email notifications for outages and recoveries.

## What it does

- Monitors HTTP endpoints with configurable methods, headers, request bodies, and timeouts
- Supports validation rules for status codes and response content
- Tracks check history, incidents, downtime, and simple service reports
- Lets each service keep only the last N request logs, with N configured per service
- Retries failed checks based on per-service retry policies
- Sends email notifications through configurable SMTP settings
- Stores notification policies and delivery logs per service
- Uses JWT authentication for the API and a React dashboard for management

## Stack

- Backend: Django 6, Django REST Framework, Simple JWT, Celery, django-celery-beat
- Frontend: React, react-router-dom, axios, recharts
- Database: SQLite for local development
- Background services: Redis for Celery broker/result backend

## Repository layout

```text
backend/
  config/           Django project settings, URL routing, Celery bootstrap
  monitoring/       Services, validation rules, retries, incidents, reports
  notifications/    SMTP config, notification policies, delivery logs
frontend/
  src/              React app, pages, API client, auth context
```

## Local development

### Prerequisites

- Python 3.12+
- Node.js 20+
- npm
- Redis, if you want scheduled/background checks to run through Celery

### 1. Start the backend

PowerShell:

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
py manage.py migrate
py manage.py runserver
```

The API will be available at `http://localhost:8000/api/`.

### 2. Start the frontend

```powershell
cd frontend
npm install
npm start
```

The frontend will be available at `http://localhost:3000`.

This app uses Create React App scripts, so the correct development command is `npm start`, not `npm run dev`.

### 3. Run background checks with Celery

The project is configured to use Redis at `redis://localhost:6379/0`.

Start a worker:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
celery -A config worker --loglevel=info --pool=solo
```

Start beat:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
celery -A config beat --loglevel=info
```

Notes:

- `--pool=solo` is the safest Celery worker mode on Windows.
- Beat uses `django-celery-beat`, so periodic schedules are stored in the database.
- Active services automatically get their own periodic task based on `check_interval_seconds`.
- The task used for scheduled monitoring is `monitoring.tasks.run_service_check`.
- If you do not run Redis/Celery, the web app and API still work, but automated background checks will not run.

## Authentication

- Register: `POST /api/auth/register/`
- Login: `POST /api/auth/token/`
- Refresh token: `POST /api/auth/token/refresh/`

Most API routes require authentication with a Bearer token.

## Main API areas

- `/api/services/` for monitored services
- `/api/services/{id}/stats/` for 24-hour service metrics
- `/api/validation-rules/` for response validation rules
- `/api/retry-policies/` for retry behavior
- `/api/ping-endpoints/` for supplementary network reachability checks
- `/api/check-results/` for historical check results
- `/api/incidents/` for active and resolved incidents
- `/api/reports/` for aggregated reporting
- `/api/notifications/smtp-config/` for SMTP configuration, including test send
- `/api/notifications/policies/` for notification preferences and recipients
- `/api/notifications/logs/` for notification delivery history

## Configuration notes

Important local settings currently live in `backend/config/settings.py`:

- `CORS_ALLOWED_ORIGINS`
- `FIELD_ENCRYPTION_KEY`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`

The frontend API base URL defaults to `http://localhost:8000/api` and can be overridden with `REACT_APP_API_BASE`.

Before using this project outside local development, move secrets and environment-specific settings out of source control and into environment variables or a dedicated config layer.

## Docker Compose deployment

The repository includes a production-oriented Docker Compose stack with PostgreSQL, Redis, Gunicorn, Celery worker, Celery beat, and an Nginx reverse proxy serving the React build.

Quick start:

```powershell
copy .env.example .env
docker compose up --build -d
```

The default published port is `18080`, so the application is available at `http://localhost:18080`.

Useful commands:

```powershell
docker compose ps
docker compose logs backend --tail 200
docker compose down
```

## Tests

Backend:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
py manage.py test
```

Frontend:

```powershell
cd frontend
npx react-scripts test --watchAll=false
```

## Common workflow

1. Start Redis if you need background monitoring.
2. Start the Django API.
3. Start the React frontend.
4. Create a user from the registration screen or through the auth API.
5. Add one or more services.
6. Configure validation rules, retry policies, and notification policies.
7. Service schedules are synced automatically in `django-celery-beat` from each service's `check_interval_seconds` value.

## Current implementation notes

- The backend defaults to SQLite, which is convenient for local development.
- SMTP passwords are stored encrypted through the notifications app.
- Service checks support both plain status-code validation and content-based validation.
- Incident records are opened automatically on transition to DOWN and closed on recovery.
- Saving or updating a service automatically creates or updates its Celery Beat schedule.