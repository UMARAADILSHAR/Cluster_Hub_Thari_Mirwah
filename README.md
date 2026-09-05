# Hub Cluster Data Collection System

Web application for Hub Cluster School Enrolment & Facilities data collection, backed by PostgreSQL, ready for local execution and deployment on Railway.

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- **Node.js**: v18+ (tested on v24)
- **PostgreSQL**: v14+ (tested on v18.4) running on port `5432`

### 2. Environment Configuration
The `.env` file is pre-configured with your verified PostgreSQL credentials:
```env
PORT=3000
NODE_ENV=development

PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=jawadJAAN@1951
PGDATABASE=hub_cluster_db
PGSSL=false
```

### 3. Run the Application
```bash
# Start the production/standard server
npm start

# Or start with auto-reload for development
npm run dev
```

Open your browser at:
👉 **`http://localhost:3000`**

On initial startup, the database schema and all 23 schools (1 Hub + 22 Cell schools) from Cluster `KX03099` are automatically migrated and seeded.

---

## ☁️ Deploying to Railway (Step-by-Step)

See the comprehensive [RAILWAY_GUIDE.md](file:///c:/Users/user/Downloads/Hub_Cluster_Data/RAILWAY_GUIDE.md) for full instructions:
1. Push this project to GitHub.
2. Log in to [Railway.app](https://railway.app).
3. Create **New Project** > **Deploy from GitHub repo**.
4. Click **+ New** > **Database** > **Add PostgreSQL**.
5. Connect your service to PostgreSQL: Railway automatically provides `DATABASE_URL`.
6. Railway will automatically build and launch the application using `railway.json` and `Procfile`.

---

## 🛠️ API Reference

- `GET /api/health` — PostgreSQL connection status, database name, and response latency.
- `GET /api/clusters` — Retrieve all clusters, schools, and class enrolment figures.
- `POST /api/clusters` — Create a new cluster.
- `POST /api/clusters/:code/schools` — Add a new school to a cluster.
- `PUT /api/schools/:id` — Update school metadata (name, type, SEMIS, head teacher, etc.).
- `DELETE /api/schools/:id` — Remove a cell school and its class records.
- `PUT /api/schools/:id/classes` — Update class enrolment numbers with auto-persistence.
- `POST /api/clusters/:code/reset` — Reset all class enrolments in a cluster to zero.
