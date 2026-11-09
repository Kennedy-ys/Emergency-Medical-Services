# EMS Connect — Tech Stack

Version 1.0 · 2026-11-09

What the project is built with, what changes, and why. "Keep" means it is already in `package.json`.

## 1. Overview

```
Phone / desktop browser (PWA)
  React + Vite + Tailwind + Leaflet
  Service worker: app shell cache, push, offline outbox
        │  HTTPS + WebSocket
        ▼
Supabase
  Auth ─ Postgres (+PostGIS, row-level security) ─ Realtime ─ Storage ─ Edge Functions
        │                                                        │
        ▼                                                        ▼
  SMS provider (login codes)                         Web Push services (Google, Apple)
```

## 2. Front end

| Concern | Choice | Status | Notes |
|---|---|---|---|
| Language | JavaScript (ES modules), JSDoc types on shared code | Keep | TypeScript is a later option; not worth the churn during the backend move |
| UI library | React 19 | Keep | |
| Build | Vite 6 | Keep | |
| Routing | React Router 7 | Keep | Move to one route table with lazy-loaded role areas |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` | Keep | Tokens in `@theme`; see Front-end Guidelines |
| Accessible primitives | Headless UI | Keep | Dialogs, menus, listboxes |
| Icons | `react-icons` | Keep | Single icon source |
| Server data | TanStack Query | **Add** | Caching, retries, loading and error states in one place |
| Backend client | `@supabase/supabase-js` | **Add** | Replaces `firebase` |
| Forms | React Hook Form + Zod | **Add** | One validation schema per form, reused for the offline outbox |
| Maps | Leaflet + React Leaflet | Keep | |
| Routing on map | Leaflet Routing Machine | Keep, repoint | Must use a production routing server (section 6) |
| Toasts | react-hot-toast | Keep | |
| Dates | date-fns | Keep | |
| CSV export | PapaParse | Keep | Admin records export |
| Local storage | `idb` (IndexedDB) | Keep | Offline outbox |
| PWA | vite-plugin-pwa (Workbox) | Keep | Add a push handler script |

**Remove:** `firebase`, `@capacitor/geolocation`, `react-feather`, `@fortawesome/fontawesome-free` (none are imported anywhere), `@heroicons/react` (one file; switch to `react-icons`), `workbox-cli` (old v2, unused), `tailwind.config.js` and `postcss.config.cjs` if nothing breaks without them (Tailwind 4 runs through the Vite plugin). `aos`, `typewriter-effect` and `react-scroll` are used only on the landing page; keep or drop when it is redesigned.

## 3. Backend: Supabase

Replaces Firebase Realtime Database and Firebase Auth.

| Piece | Used for |
|---|---|
| Postgres | All data. Schema, constraints and functions in [Backend Schema](05-BACKEND-SCHEMA.md) |
| Distance queries | Nearest hospitals and drivers, using a plain SQL distance function (PostGIS was dropped as unnecessary at city scale) |
| Row-level security | Per-role access enforced in the database, not in the React code |
| Auth | Anonymous sessions for first-time requesters; phone + SMS code for patients; email + password for drivers, technicians, admins |
| Realtime | Live updates for requests, driver positions and chat messages |
| Storage | Driver photos (public bucket), chat images (private bucket, signed URLs) |
| Edge Functions | Send push notifications, auto-assign job, staff invites, SMS hook if needed |
| pg_cron | Timed jobs: mark stale drivers offline, auto-assign unaccepted requests |
| Supabase CLI | Local development stack and versioned SQL migrations in `supabase/migrations/` |

**Why Supabase over staying on Firebase:** relational data with real constraints (one active trip per driver, legal status transitions), SQL access rules that can be reviewed and tested, and geographic queries. **Cost:** every data call in the app is rewritten; this is the biggest item in the plan.

**Region:** choose the available region with the lowest latency from Nigeria (expected to be a European one). Measure before committing; it cannot be changed later without a migration.

## 4. Notifications

- **Web Push** with VAPID keys. The browser subscription is stored per user; an Edge Function sends the message.
- Works on Android Chrome in the browser or installed. On iPhone it works only after the app is added to the Home Screen (iOS 16.4 or later); drivers on iPhone must install it.
- The Edge Function push library needs a short proof of concept first, because Edge Functions run on Deno rather than Node.
- In-app sound and banner remain as the fallback.

## 5. SMS for phone login

Supabase has built-in support for Twilio, MessageBird, Vonage and Textlocal. Nigerian providers such as Termii can be connected through Supabase's "Send SMS" auth hook. Decide on delivery rates and price to Nigerian networks; test with MTN, Airtel, Glo and 9mobile numbers before the pilot.

## 6. Maps and routing — must change before pilot

The app currently loads map tiles from `tile.openstreetmap.org`, bulk-precaches them (`generateTiles.cjs`, `precache-map-tiles.js`), and gets routes from the default public OSRM demo server. The operators of both prohibit this kind of production and bulk use, and the routing demo server has no uptime guarantee.

| Need | Options |
|---|---|
| Map tiles | A hosted provider with a free or low tier (MapTiler, Stadia Maps, Thunderforest), or self-hosted tiles for the Calabar area |
| Routing and ETA | A hosted routing API (OpenRouteService, Mapbox Directions, GraphHopper) or a self-hosted OSRM with a Nigeria extract |
| Offline map | Pre-packaged Calabar tiles only if the chosen provider's terms allow it |

Keys for these go in environment variables and are restricted to the app's domain.

## 7. Offline strategy

| Data | Strategy |
|---|---|
| App shell, first-aid content | Precached by the service worker |
| Hospital list | Cached by TanStack Query and persisted; refreshed when online |
| New request, patient record | Written to an IndexedDB outbox with a client-generated ID; sent on reconnect; server ignores duplicates of the same ID |
| Tracking, chat, dispatch | Online only, with a clear "reconnecting" state |

## 8. Quality and operations

| Concern | Choice |
|---|---|
| Lint | ESLint 9 (keep) |
| Format | Prettier (**add**) |
| Unit and component tests | Vitest + React Testing Library (**add**) |
| End-to-end tests | Playwright against the local Supabase stack (**add**): request → accept → complete |
| Access-rule tests | SQL tests that sign in as each role and check what it can read and write |
| Error monitoring | Sentry (**add**) |
| Hosting | Static hosting with HTTPS and SPA fallback (Vercel, Netlify or Cloudflare Pages) — to decide |
| CI | GitHub Actions: lint, test, build on every push; migrations applied on merge to `main` |
| Environments | Local (Supabase CLI), staging project, production project |

## 9. Configuration and secrets

- Browser-safe values in `.env.local` (not committed), with a committed `.env.example`:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_MAP_TILE_URL`, `VITE_ROUTING_URL`, `VITE_SENTRY_DSN`.
- Server-only secrets live in Supabase function secrets, never in the repo or in `VITE_` variables: service role key, VAPID private key, SMS provider key.
- **Existing issue:** a Firebase service account key was committed in the first commit (`658c5a4`, `set-admin-claim/serviceAccountKey.json`) and is still in git history. Revoke that key in Google Cloud regardless of the migration. See Implementation Plan phase 0.

## 10. Leaving Firebase

| Firebase item | Supabase replacement |
|---|---|
| Realtime Database paths | Postgres tables (mapping in Backend Schema section 9) |
| Email/password auth | Supabase Auth; the few existing test accounts re-register |
| Admin custom claim (`set-admin-claim/`) | `role` column on `profiles`; folder deleted |
| `onDisconnect` presence | `last_seen_at` heartbeat + scheduled job |
| Workbox rule caching the database URL | Removed |

The Firebase project stays read-only until the pilot is stable, then is deleted.
