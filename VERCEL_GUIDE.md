# Vercel Deployment Guide — Hub Cluster KX03099

## Overview

This app is a Node.js + Express + PostgreSQL system. Vercel runs the Express server as a **serverless function**.
The PostgreSQL database must be hosted externally. The recommended free option is **Neon** (neon.tech).

---

## Step 1 — Host PostgreSQL on Neon (free)

> You can also use Railway PostgreSQL, Supabase, or any other provider.

1. Go to [https://neon.tech](https://neon.tech) and sign up (free)
2. Create a new project → give it a name like `hub-cluster`
3. Copy the **Connection string** — it looks like:
   ```
   postgresql://neondb_owner:abc123@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this — you will need it in Step 3.

---

## Step 2 — Push Code to GitHub

1. Share your GitHub repository URL with the agent (or create one)
2. Make sure these files are **committed and pushed**:
   - `server.js`
   - `db.js`
   - `package.json`
   - `vercel.json`
   - `public/` (index.html, style.css, app.js, logo.jpg, favicon.png)
3. Make sure `.env` is in `.gitignore` (it is ✅ — never commit passwords)

Push command:
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

---

## Step 3 — Deploy on Vercel

1. Go to [https://vercel.com](https://vercel.com) → **Sign in with GitHub**
2. Click **Add New → Project**
3. Find and **Import** your `Hub_Cluster_Data` repository
4. Vercel will auto-detect the `vercel.json` config

### Set Environment Variables

In the Vercel project settings → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://...` (your Neon connection string) |
| `NODE_ENV` | `production` |

> ⚠️ Do NOT add `PORT` — Vercel manages the port automatically.

5. Click **Deploy** — Vercel will build and deploy in ~1 minute
6. You'll get a URL like: `https://hub-cluster-kx03099.vercel.app`

---

## Step 4 — Verify Deployment

Visit your Vercel URL and check:

- **Status bar** (top) shows `PostgreSQL connected` ✅
- **Enrollment Data** form loads with schools ✅
- **Admin Login** works with username `admin` ✅

You can also hit the health endpoint directly:
```
https://your-app.vercel.app/api/health
```

It should return:
```json
{ "status": "ok", "db": "connected", "latencyMs": 80 }
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Database disconnected` in status bar | Check `DATABASE_URL` env var in Vercel dashboard |
| `SSL error` | Make sure your Neon URL contains `?sslmode=require` |
| `500 error` on API | Check Vercel **Function Logs** in the dashboard |
| Slow first load | Normal — serverless functions "cold start" after inactivity |

---

## Local Development

```bash
# 1. Copy env file
cp .env.example .env
# Edit .env with your local PostgreSQL credentials

# 2. Install dependencies
npm install

# 3. Start server
npm start
# → http://localhost:3000
```

---

## Files Summary

| File | Purpose |
|---|---|
| `vercel.json` | Tells Vercel to run server.js as a serverless function |
| `server.js` | Express server (exports `app` for Vercel, calls `listen` for local) |
| `db.js` | PostgreSQL connection pool + schema initialization |
| `public/` | Static frontend files served by Express |
| `.env.example` | Template for environment variables |
| `.gitignore` | Prevents `.env` and `node_modules` from being committed |
