# PDX Surveillance Platform

Real-time health surveillance and outbreak intelligence platform for WHO AFRO. Combines disease readiness scoring, outbreak tracking, sentinel signal ingestion, HDIS briefings, and AI-powered analytics into a unified operational dashboard.

---

## Project Structure

```
PDX_Survellance_Platform/
├── backend-main/          # Django REST API (Python)
│   ├── account/           # Auth, SSO (Azure AD), user management
│   ├── datarepr/          # Django project config & settings
│   ├── hdis/              # Health Data Intelligence System
│   ├── sentinel/          # Signal ingestion & alert classification
│   ├── outbreak/          # Outbreak workspace & tracking
│   ├── readiness/         # Disease preparedness scoring
│   ├── stardata/          # STAR risk assessments
│   ├── espar/             # IHR e-SPAR compliance
│   ├── chwfolder/         # Community Health Worker data
│   ├── predictions/       # Prediction models
│   ├── supplier_form/     # Supplier registration workflow
│   ├── department_form/   # Department workflow forms
│   ├── sitrep_form/       # Situation report forms
│   ├── kobo/              # KoboToolbox CHW ingestion
│   ├── verification/      # Data verification pipeline
│   ├── pami/              # PAMI dashboard
│   ├── pip_dashboard/     # PIP dashboard
│   ├── arcgis_proxy/      # ArcGIS map proxy
│   └── requirements.txt   # Python dependencies
│
├── frontend-main/         # React + TypeScript + Vite (TailwindCSS)
│   └── src/
│       ├── pages/         # All page components
│       ├── components/    # Shared UI components
│       ├── services/      # API service layer
│       └── utils/         # Helpers & utilities
│
├── wbepi-main/            # R package — SEIRDV epidemic model
│
└── whodata-nginx.conf     # Production Nginx config (reference)
```

---

## Prerequisites

| Tool       | Version   | Install                                      |
|------------|-----------|----------------------------------------------|
| Python     | 3.9+      | `brew install python@3.12`                   |
| Node.js    | 18+       | `brew install node`                          |
| PostgreSQL | 14+       | `brew install postgresql@16`                 |
| Redis      | 7+        | `brew install redis` (optional — for Celery) |
| R          | 4.3+      | `brew install r` (only if using wbepi)       |

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/fernandesic/PDX_Survellance_Platform.git
cd PDX_Survellance_Platform
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend-main

# Create & activate virtual environment
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Create your .env file from the template
cp .env.example .env
```

Now open `.env` and fill in the **required** values:

```env
# ── REQUIRED ──────────────────────────────────────────────────
SECRET_KEY=<generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())">
DATABASE_URL=postgresql://user:password@localhost:5432/pdx_db
```

> **Tip:** Generate a secret key instantly:
> ```bash
> python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
> ```

Then run migrations and start the server:

```bash
# Run migrations
python manage.py migrate

# (Optional) Seed default users
python manage.py seed_users

# Start the dev server
python manage.py runserver
```

Backend will be running at **http://localhost:8000**

API docs available at **http://localhost:8000/swagger/**

---

### 3. Frontend Setup

Open a **new terminal**:

```bash
# Navigate to frontend
cd frontend-main

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be running at **http://localhost:5173**

---

### 4. (Optional) Celery Workers

Only needed if you want background tasks (HDIS ingestion, sentinel signals, etc.):

```bash
# Terminal 1 — Start Redis
redis-server

# Terminal 2 — Start Celery worker
cd backend-main
source venv/bin/activate
celery -A datarepr worker --loglevel=info

# Terminal 3 — Start Celery Beat (scheduled tasks)
celery -A datarepr beat --loglevel=info
```

---

### 5. (Optional) LLM — Ollama

For AI-powered HDIS briefings and agent classification:

```bash
# Install Ollama
brew install ollama

# Pull the model
ollama pull llama3.2:1b

# Start Ollama server
ollama serve
```

Configure in `.env`:
```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=llama3.2:1b
```

---

## Environment Variables

All env vars are documented in [`backend-main/.env.example`](backend-main/.env.example). Here's a summary of the key groups:

| Group                | Required? | Description                              |
|----------------------|-----------|------------------------------------------|
| `SECRET_KEY`         | ✅ Yes    | Django cryptographic signing key         |
| `DATABASE_URL`       | ✅ Yes    | PostgreSQL connection string             |
| `EMAIL_*`            | Optional  | SMTP / SendGrid for email notifications  |
| `AZURE_AD_*`         | Optional  | Microsoft SSO (Entra ID)                 |
| `CELERY_*`           | Optional  | Redis broker for background tasks        |
| `LLM_*`              | Optional  | Ollama / cloud LLM for AI features       |
| `KOBO_*`             | Optional  | KoboToolbox CHW field report ingestion   |
| `OUTBREAK_*`         | Optional  | ACLED, GFW, HDX, NASA external data      |
| `ALERT_TELEGRAM_*`   | Optional  | Telegram bot for alert notifications     |

---

## Key Commands

```bash
# ── Backend ──────────────────────────────────────
python manage.py runserver              # Start Django dev server
python manage.py migrate                # Run database migrations
python manage.py seed_users             # Seed default user accounts
python manage.py createsuperuser        # Create admin user
python manage.py crontab add            # Activate scheduled cron jobs
python manage.py crontab show           # List active cron jobs
python manage.py collectstatic          # Collect static files (production)

# ── Frontend ─────────────────────────────────────
npm run dev                             # Start Vite dev server
npm run build                           # Production build
npm run lint                            # Run ESLint
npm run test                            # Run unit tests
npm run test:watch                      # Run tests in watch mode

# ── Celery ───────────────────────────────────────
celery -A datarepr worker --loglevel=info     # Start worker
celery -A datarepr beat --loglevel=info       # Start scheduler
```

---

## Production Deployment

The production setup uses:
- **Nginx** as reverse proxy (see `whodata-nginx.conf`)
- **Gunicorn** via Unix socket for Django
- **Let's Encrypt** for SSL
- Frontend built with `npm run build`, served as static files from `/var/www/frontend/dist`

---

## Tech Stack

| Layer     | Technology                                               |
|-----------|----------------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, TailwindCSS, Recharts, Three.js |
| Backend   | Django 4.2, Django REST Framework, PostgreSQL             |
| Auth      | JWT (httpOnly cookies) + Microsoft Azure AD SSO           |
| Tasks     | Celery + Redis                                            |
| AI/LLM    | Ollama (local) with cloud fallback                        |
| Maps      | ArcGIS JS SDK                                             |
| Epi Model | R (SEIRDV via rpy2)                                       |
