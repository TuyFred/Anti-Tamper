# Deployment Guide — Vercel (client) + Render (server)

## Architecture

| Service | Platform | Folder |
|---------|----------|--------|
| React frontend | **Vercel** | `client/` |
| Node API + Socket.IO + MQTT | **Render** | `server/` |
| Database & Auth | **Supabase** | run SQL in dashboard |

---

## 1. Supabase (first)

Run in Supabase SQL Editor, in order:

1. `supabase/schema.sql`
2. `supabase/delivery-system.sql`
3. `supabase/seed-admin.sql`

In **Authentication → URL configuration**, add:

- Site URL: `https://YOUR-APP.vercel.app`
- Redirect URLs: `https://YOUR-APP.vercel.app/**`, `http://localhost:5173/**`

---

## 2. Render — backend API

### Option A: Blueprint (recommended)

1. Push repo to GitHub
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect repo — Render reads `render.yaml`
4. Fill secret env vars when prompted

### Option B: Manual Web Service

1. **New** → **Web Service** → connect GitHub repo
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. Copy variables from `server/.env.example`

### Required Render env vars

| Variable | Example |
|----------|---------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key |
| `CLIENT_URL` | `https://your-app.vercel.app` |
| `PUBLIC_BASE_URL` | `https://smart-box-api.onrender.com` |
| `MQTT_BROKER_URL` | `mqtt://test.mosquitto.org:1883` |

After deploy, open `https://YOUR-API.onrender.com/health` — should return `{ "status": "ok" }`.

> **Note:** Render free tier spins down after inactivity (~50s cold start). Promo video **uploads** are stored on ephemeral disk and may be lost on redeploy — use YouTube/external URLs for production videos, or upgrade to persistent disk.

---

## 3. Vercel — frontend

1. [Vercel Dashboard](https://vercel.com) → **Add New** → **Project**
2. Import GitHub repo
3. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Environment variables — copy from `client/.env.example`:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_URL` | Render API URL |
| `VITE_SOCKET_URL` | Same as `VITE_API_URL` |

5. Deploy

`client/vercel.json` handles SPA routing (React Router).

CORS: the server allows `CLIENT_URL` and any `*.vercel.app` preview URL automatically.

---

## 4. Link frontend ↔ backend

1. Set Render `CLIENT_URL` to your Vercel production URL
2. Set Vercel `VITE_API_URL` and `VITE_SOCKET_URL` to Render URL
3. Redeploy **both** after changing env vars

---

## 5. Local development

```bash
# Terminal 1 — API
cd server && npm install && npm run dev

# Terminal 2 — Client
cd client && npm install && npm run dev
```

Use `client/.env` and `server/.env` with localhost URLs.

---

## 6. ESP32 / MQTT

Point firmware to the same MQTT broker as `MQTT_BROKER_URL` on Render.  
Public brokers (e.g. test.mosquitto.org) work for demos; use a private broker for production.

---

## Checklist

- [ ] Supabase SQL scripts executed
- [ ] Supabase auth redirect URLs include Vercel domain
- [ ] Render `/health` returns OK
- [ ] Vercel app loads and login works
- [ ] Real-time (Socket.IO) shows "Live updates" on dashboard
- [ ] `CLIENT_URL` on Render matches Vercel URL exactly (https, no trailing slash)
