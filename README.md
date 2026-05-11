# PromptEnhancer Pro

AI-powered prompt enhancement tool. Invite-only, BYOK (Bring Your Own API Key). Better than PromptSloth — no subscription needed.

## What it does

Transforms vague prompts into powerful AI instructions with one click. Works on ChatGPT, Claude, Gemini, and any website.

**5 modes:** Enhance · Professional · Shorten · Code · Creative

## Platforms

| Tool | Description |
|------|-------------|
| Chrome Extension | Floating ✨ button on any AI chat |
| VS Code Extension | `Ctrl+Shift+E` to enhance prompts while coding |
| Python CLI | `pe "your prompt"` in any terminal |
| Web Dashboard | Usage analytics at your backend URL |

## Stack

- **Backend:** Django 5, DRF, PostgreSQL (Railway/Render)
- **Extension:** React + TypeScript + Vite + CRXJS
- **AI:** Groq (Llama 3.3 70B) or Google Gemini — user's own API key

## Production Setup

### 1. Deploy Backend to Railway

Set these environment variables in Railway:

```
SECRET_KEY=<generate a strong key>
DEBUG=False
ALLOWED_HOSTS=*
DATABASE_URL=<auto-set by Railway Postgres>
GEMINI_API_KEY=<your key, optional — for VS Code/CLI>
BACKEND_URL=https://your-app.railway.app
ADMIN_EMAIL=yokeshkumar1704@gmail.com
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=<Gmail App Password>
DEFAULT_FROM_EMAIL=PromptEnhancer Pro <noreply@your-domain.com>
```

The `create_admin` command runs automatically on deploy and creates:
- **Username:** `yokesh` | **Password:** `ThisisaworkingModel` | **Email:** `yokeshkumar1704@gmail.com`

### 2. Build & Load Chrome Extension

```bash
cd extension-react
npm install
npm run build     # outputs to dist/
```

Load `extension-react/dist/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

### 3. Configure Extension

1. Enter your invite code (create one in Django admin → Invite Codes)
2. Go to Settings tab → choose Groq or Gemini → paste your API key
   - **Groq (free, fast):** https://console.groq.com/keys
   - **Gemini (free):** https://aistudio.google.com/apikey

### 4. Admin Panel

Visit `/admin/` — log in as `yokesh` / `ThisisaworkingModel`

**Admin actions:**
- **Access Requests** → Approve and auto-email invite codes
- **Invite Codes** → Send invite emails manually
- **Enhancement Logs** → View all usage data

## User Flow

1. User visits your web app → clicks "Request Access" → submits email
2. You approve in admin → invite code is emailed automatically
3. User registers at `/register/?code=INVITE_CODE`
4. User installs extension, enters invite code + API key
5. Click ✨ on any AI chat to enhance prompts

## Local Development

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env   # fill in values
python manage.py migrate
python manage.py create_admin
python manage.py runserver

# Extension
cd extension-react && npm install && npm run dev
```
