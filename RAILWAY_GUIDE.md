# Complete Railway Deployment Guide

This guide walks you through deploying the **Hub Cluster Data Collection** system and connecting it to a managed PostgreSQL database on [Railway](https://railway.app).

---

## 📋 Overview of Deployment Flow

Railway automatically provisions containers for Node.js apps and provides managed PostgreSQL plugins. When you connect a PostgreSQL database plugin in Railway, it automatically sets the `DATABASE_URL` environment variable for your application service.

Our backend (`db.js` and `server.js`) is pre-configured to detect `DATABASE_URL`, enable SSL automatically in production, and run database migrations/seeds on the very first start!

---

## Step 1: Push Code to GitHub

1. Initialize git in your project directory (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Hub Cluster Data Collection System with PostgreSQL"
   ```

2. Create a new repository on [GitHub](https://github.com/new) (public or private).

3. Link your remote repository and push:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
   git branch -M main
   git push -u origin main
   ```

*(Note: `.env` is already in `.gitignore`, protecting your local credentials)*

---

## Step 2: Create a Project on Railway

1. Go to [https://railway.app](https://railway.app) and sign in (using GitHub).
2. Click the **"+ New Project"** button in the top right.
3. Select **"Deploy from GitHub repo"**.
4. Choose the repository you just pushed (`<YOUR_REPO_NAME>`).
5. Click **"Deploy Now"**.

---

## Step 3: Add PostgreSQL Database on Railway

1. In your Railway project canvas, click the **"+ New"** button.
2. Select **"Database"** > **"Add PostgreSQL"**.
3. Railway will provision a managed PostgreSQL database container within 30 seconds.

---

## Step 4: Link Database to your Web Application

1. Click on your **Web Service** card (the one deployed from GitHub).
2. Go to the **"Variables"** tab.
3. Click **"New Variable"** > **"Add Reference"** (or click **"Add Variable"**).
4. Select `DATABASE_URL` from the PostgreSQL service.
   - Alternatively: Railway automatically shares `DATABASE_URL` between services in the same project if you link them!
5. Ensure `NODE_ENV` is set to `production`.

---

## Step 5: Generate a Public Domain

1. In your **Web Service** settings, go to the **"Settings"** tab.
2. Scroll down to the **"Networking"** section.
3. Click **"Generate Domain"** (e.g. `hub-cluster-production.up.railway.app`).
4. Click the generated URL to open your live dashboard!

---

## Step 6: Verify Deployment

1. Check the top bar: it will display `🟢 Connected: PostgreSQL (railway)`.
2. All 23 schools (GBHS Thari Mirwah, C1, and C2 cell schools) will automatically load and be seeded in the Railway PostgreSQL database.
3. Any edits you make in the **Data Entry** or **Schools** tabs will instantly persist to the Railway cloud database.

---

## 🔧 Technical Notes & Configuration

### Special Password Characters (`@` handling)
If you ever manually set a `DATABASE_URL` containing an `@` character in the password (such as `jawadJAAN@1951`), remember that in connection strings, `@` must be URL-encoded as `%40`:
```
postgresql://postgres:jawadJAAN%401951@host:5432/dbname
```
In Railway, Railway generates random secure alphanumeric passwords without special character conflicts, and injects `DATABASE_URL` directly.

### Healthcheck Path
The application provides `GET /api/health`, which is declared in `railway.json`. Railway uses this endpoint to ensure zero-downtime deploys and auto-healing.
