Anti-Tamper Smart Delivery Box Platform — System Document
=========================================================

This document describes the full system: architecture, components, data model, APIs, user flows, deployment, developer setup, security notes, and a chaptered "book" outline you can use to produce end-user and developer documentation.

Files referenced in this document (workspace-relative):
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [client/package.json](client/package.json)
- [server/package.json](server/package.json)
- [server/src/index.js](server/src/index.js)
- [client/src/App.jsx](client/src/App.jsx)
- [supabase/full-setup.sql](supabase/full-setup.sql)

1. Executive Summary
--------------------
- Purpose: Provide a secure, real-time smart delivery box platform with anti-tamper detection, delivery orchestration, role-based access, and a lightweight admin UI.
- Key capabilities:
  - Real-time device telemetry (GPS, tamper, shock)
  - Secure delivery requests with token-based unlocks
  - Role-based management (admin, manager, operator, rider, customer)
  - Promo video management and uploads
  - Reports and PDF generation

2. High-level Architecture
--------------------------
- Frontend: React + Vite app in `client/`. Uses Supabase for auth and data, Socket.IO for live updates, Leaflet for maps.
- Backend: Node.js Express API in `server/` exposing REST endpoints plus Socket.IO; integrates MQTT to receive telemetry from devices and bridges events to web clients.
- Database & Auth: Supabase (Postgres + Auth). SQL scripts under `supabase/` provision roles, tables, triggers and RLS policies.
- Firmware / IoT: ESP32 firmware (in `firmware/`) communicates via MQTT broker configured by `MQTT_BROKER_URL`.
- Storage: Server exposes `/uploads` for promo videos (ephemeral on Render). For production use external storage (S3/Cloud Storage) or video hosting.

3. Components and Responsibilities
----------------------------------
- Client (`client/`)
  - React app using `@supabase/supabase-js` for auth & DB access.
  - Routes and protected pages defined in `client/src/App.jsx`.
  - Uses Socket.IO client for live updates and `leaflet` for maps.
- Server (`server/`)
  - Express app (main `server/src/index.js`) registers REST routes: `/api/users`, `/api/devices`, `/api/deliveries`, `/api/reviews`, `/api/promo-videos`, `/api/alerts`, `/api/locations`, `/api/reports`.
  - MQTT handler subscribes to device topics, updates DB, and pushes Socket.IO events.
  - Uploads middleware serves files under `/uploads`.
  - Health check endpoint: `/health`.
- Supabase (`supabase/`)
  - Full schema and seed scripts in `full-setup.sql` (roles, permissions, profiles, devices, alerts, deliveries, promo videos, RLS policies, triggers).
- Firmware (`firmware/`)
  - ESP32 example sketches publish telemetry and receive commands via MQTT.

4. Data Model (summary from `supabase/full-setup.sql`)
-----------------------------------------------------
- Roles & Permissions: `roles`, `permissions`, `role_permissions` — maps role → allowed actions.
- Profiles: `profiles` linked to `auth.users` with `is_approved` flag and `role_id`.
- Devices: `devices` store `device_id`, `name`, `is_online`, `latitude`, `longitude`, `tamper_status`, `shock_detected`, `lock_status`, etc.
- Device Access: `device_access` assigns specific users access & control rights to devices.
- Alerts: `alerts` include event_type (`gps`, `tamper`, `shock`, `unauthorized`, `system`), severity, coordinates, metadata, acknowledgement fields.
- Delivery Requests: `delivery_requests` track customer, rider, assigned device, status lifecycle, price, payment proof, unlock tokens, and timestamps.
- Delivery Reviews: `delivery_reviews` with rating and comment.
- Promo Videos: `promo_videos` metadata for videos used in UI (title, url, poster, section, is_playing).

5. API Endpoints (overview)
---------------------------
(Registered in `server/src/index.js`) primary route prefixes:
- `GET /health` — basic health check
- `/api/users` — user and profile management (approval flows)
- `/api/devices` — device registration, status, control commands (unlock, buzzer)
- `/api/deliveries` — create and manage delivery requests, payment verification, token lifecycle
- `/api/reviews` — submit and fetch delivery reviews
- `/api/promo-videos` — upload and manage promo content
- `/api/alerts` — fetch and acknowledge alerts
- `/api/locations` — location lookup / Rwanda locations table
- `/api/reports` — generate or fetch PDF reports

Implementation notes:
- Many endpoints rely on Supabase RLS and `profiles` for authorization.
- Socket.IO is initialized in `server/src/socket/index.js` (see server code for event names).
- MQTT bridging lives under `server/src/mqtt/` and `server/src/mqtt/handler.js`.

6. Authentication & Authorization
---------------------------------
- Supabase Auth is used for sign-up / sign-in.
- `profiles` table is created via a trigger when a new `auth.users` row is inserted; default role is `customer`.
- Row-Level Security (RLS) policies are enabled for main tables; functions such as `public.user_has_permission` exist to check granular permissions.
- Approval flow: users are `is_approved=false` until a manager/admin approves; UI gating uses `isApproved` and role checks (see `client/src/App.jsx` and `ProtectedRoute`).

7. User Roles & Typical Flows
----------------------------
- Customer
  - Sign up, create delivery request, submit payment proof, receive unlock token, collect package.
- Manager
  - Approve accounts, verify payments, assign riders, manage devices and promo videos, run reports.
- Motor Rider
  - Receive assigned deliveries, view navigation, use unlock token to open box, mark delivery complete.
- Operator / Viewer
  - View device telemetry and alerts (operators can control devices if granted permissions).

8. MQTT & Firmware Integration
------------------------------
- ESP32 devices publish telemetry messages to topics the server subscribes to (broker configured by `MQTT_BROKER_URL`).
- Server parses incoming payloads, updates `devices` rows and inserts `alerts` when tamper/shock events occur.
- For sending commands (unlock, buzzer, led) server publishes MQTT messages to device-specific topics.
- For demos a public broker like `mqtt://test.mosquitto.org:1883` is usable; production should use authenticated broker or cloud IoT service.

9. Deployment & Environment Variables (summary from `DEPLOYMENT.md`)
------------------------------------------------------------------
- Frontend: deploy `client/` to Vercel. Important env vars for Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_SOCKET_URL`.
- Backend: deploy `server/` to Render. Important Render env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLIENT_URL`, `PUBLIC_BASE_URL`, `MQTT_BROKER_URL`.
- Supabase: run SQL scripts in order: `supabase/schema.sql` (or `full-setup.sql`), `supabase/delivery-system.sql`, `supabase/seed-admin.sql`.
- Health check endpoint: `/health` should return JSON status.

10. Developer Setup & Local Run
------------------------------
- Server and client are independent packages. From repo root:

```powershell
# Terminal 1 — API
cd server
npm install
npm run dev

# Terminal 2 — Client
cd client
npm install
npm run dev
```

- Use local `.env` files in `server/` and `client/` with corresponding values. For Supabase local testing, connect to the hosted Supabase project or a local Postgres instance with compatible schema.

11. Database Migration & Supabase Notes
--------------------------------------
- `supabase/full-setup.sql` contains a complete provision path, creates RLS policies and triggers — intended to run once in a fresh Supabase project.
- Default admin seeded: `admin@system.com` / `admin123@` (change before production).
- If re-running, use `supabase/remove-seed-data.sql` to clear previous seeds.

12. Security Considerations
---------------------------
- Never commit `SUPABASE_SERVICE_ROLE_KEY` to client or version control. Keep it only on server Render env.
- Use HTTPS endpoints and configure `CLIENT_URL` and redirect URIs in Supabase Auth settings.
- For production video storage avoid server-local disk (ephemeral on Render) — use S3 or cloud storage and serve via signed URLs if needed.
- Enforce strong passwords and rotate service keys.

13. Operations & Monitoring
---------------------------
- Health endpoint: monitor `/health`.
- Logs: use Render / Vercel logs and consider integrating an external logging/monitoring service.
- Alerting: critical `alerts` created in DB; consider forwarding critical alerts to email/SMS via `nodemailer` or third-party alerting.
- Backups: schedule Supabase automated backups or export schema and data regularly.

14. Book (Documentation) Outline
-------------------------------
Use this chaptered outline to turn the system documentation into a full book or manual. Each chapter should include diagrams, screenshots, code snippets, and practical exercises.

Chapter 1 — Introduction
- What the system does, target audience, demo overview.

Chapter 2 — Architecture Overview
- System diagram, component roles, data flow (MQTT → Server → Supabase → Client).

Chapter 3 — Data Model and Policies
- Full table descriptions, RLS examples, triggers, indexing strategies.

Chapter 4 — Frontend Walkthrough
- Project layout (`client/`), routing, auth flows, maps, Socket.IO integration, UI screenshots.

Chapter 5 — Backend Walkthrough
- Project layout (`server/`), API endpoints, middleware, Socket.IO, MQTT handler, uploads, health checks.

Chapter 6 — Firmware & Device Integration
- ESP32 code examples, MQTT topics, payload schemas, security for devices.

Chapter 7 — Delivery Process
- End-to-end flow: request → payment → verification → token issuance → delivery → review.

Chapter 8 — Deployment & Operations
- Vercel + Render setup, environment variables, CI/CD, backups, monitoring.

Chapter 9 — Security & Privacy
- Secrets management, RLS, data retention and GDPR-like considerations.

Chapter 10 — Developer Guide & Contribution
- Local setup, tests, code style, release notes, how to add features.

Appendices
- A: Supabase SQL reference snippets
- B: API reference (detailed endpoints, request/response)
- C: Troubleshooting & FAQs

15. Suggested Next Steps
-----------------------
- I can commit this document to `docs/SYSTEM_BOOK.md` (done). Would you like:
  - A generated PDF or GitBook-compatible structure?
  - An OpenAPI / Swagger spec derived from server routes?
  - A fully written Chapter (pick one) with screenshots and code excerpts?

---

Generated by scanning project manifests, `DEPLOYMENT.md`, `server/src/index.js`, `client/src/App.jsx`, and `supabase/full-setup.sql`.

If you want more detail in any chapter, pick a chapter number and I will expand it into a complete write-up with code examples and suggested diagrams.
