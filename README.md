# PromptEnhancer Pro

> AI-powered prompt enhancement — admin-approved access, BYOK, multi-platform.

## Repository Structure

```
PromptEnhancer/
├── backend/              # Django 5 REST API (Render / Railway)
│   ├── prompt_engine/    # Core app — auth, enhancement, admin
│   ├── prompt_enhancer_backend/  # Django project settings
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── render.yaml
│   └── railway.toml
│
├── frontend/             # React + Vite + TypeScript web app (Vercel)
│   ├── src/
│   │   ├── pages/        # Landing, Login, Register, Dashboard, RequestAccess
│   │   ├── lib/api.ts    # Centralized API client
│   │   ├── App.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vercel.json
│
├── extension/            # Chrome extension (React + Vite + CRXJS)
│
├── vscode-extension/     # VS Code extension (TypeScript)
│
├── cli/                  # Python CLI tool
│   ├── enhance.py
│   ├── shell_integration.sh
│   └── shell_integration.ps1
│
├── .github/workflows/
│   ├── deploy.yml        # Full CI/CD — backend, frontend, extensions, release
│   └── keepalive.yml     # Render free-tier keep-alive ping
│
├── docker-compose.yml    # Local full-stack dev environment
└── render.yaml           # Render deployment config
```

## What It Does

Transforms vague prompts into powerful AI instructions with one click.

**5 enhancement modes:** Enhance · Professional · Shorten · Code · Creative

**Works on:** ChatGPT, Claude, Gemini, Perplexity, Copilot, Mistral, Poe — any website.

**Zero subscription:** Bring your own free [Groq](https://console.groq.com/keys) or [Gemini](https://aistudio.google.com/apikey) API key.

## Local Development

### Backend

```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env          # fill in values
python manage.py migrate
python manage.py create_admin
python manage.py runserver
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
# create .env with: VITE_BACKEND_URL=http://localhost:8000
npm run dev
# → http://localhost:5173
```

### Chrome Extension

```bash
cd extension
npm install
npm run dev    # hot-reload dev build
# or
npm run build  # production build → load extension/dist/ in Chrome
```

### Full Stack (Docker)

```bash
docker compose up --build
# backend → http://localhost:8000
# frontend → http://localhost:5173
```

## Production Deployment

### Backend → Render

The `render.yaml` at the root auto-configures the backend service with `rootDir: backend`.

Required secrets in Render dashboard:
- `GEMINI_API_KEY`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`

### Frontend → Vercel

Add these GitHub Secrets in the repo settings:
- `VERCEL_TOKEN` — from [vercel.com/account/tokens](https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` — `team_A2J6Pbn1fUKAi8NhIxarjxtO`

Every push to `main` triggers auto-deploy to Vercel.

## Admin Access

Sign in at `<frontend-url>/login` to reach the React admin dashboard.

The Django backend has no UI of its own — every web path (`/`, `/login/`, `/dashboard/`, `/admin/`) redirects to the Vercel frontend.
For low-level DB access, the Django admin lives at `<backend-url>/_admin/` (rarely needed).

Default admin credentials, created by `python manage.py create_admin` (idempotent, runs on deploy):
- **Username:** `yokesh`
- **Password:** `ThisisaworkingModel`
- **Email:** `yokeshkumar1704@gmail.com` (auto-promoted to staff/superuser on login)

Admin capabilities (from the React dashboard):
- Approve / reject access requests — auto-creates an account and emails the user their credentials
- View enhancement stats, usage by mode, by provider, top domains
- Quick Enhance tool (Ctrl+Enter)
