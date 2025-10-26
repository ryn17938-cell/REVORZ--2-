# REVOZ — local development

This workspace contains the REVOZ app. The actual server source lives in `REVORZ/REVORZ/server.js`.

Quick start (PowerShell on Windows):

1. Install dependencies from the repo root:

```powershell
npm install
```

2. Run in development (auto-restart on changes):

```powershell
npm run dev
```

3. Run production / run once:

```powershell
npm run start
# or
node .\app.js
```

Notes:
- The root `package.json` scripts now point directly to `REVORZ/REVORZ/server.js` for convenience.
- A small shim `app.js` exists in the repo root and will require the nested server file, so `node app.js` also works.
- The app uses a MySQL database. Create `REVORZ/REVORZ/database/.env` or set environment variables for DB connection and optional mailer configuration. Common env vars:
	- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
	- SESSION_SECRET
	- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional for email)
	- ADMIN_EMAIL (optional)

If you'd like I can also standardize the nested `package.json` or remove the shim; tell me which option you prefer.
