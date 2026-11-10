# EMS Connect

An installable web app (PWA) for requesting an ambulance in Calabar, Nigeria: patients request and track an ambulance, drivers receive and run trips, and dispatchers oversee everything from an admin console.

## Status

The app is being rebuilt for a real pilot and moved from Firebase to Supabase. Work happens on the `supabase-migration` branch and follows the implementation plan below. Phase 1 (the Supabase foundation) is in place: the hospital finder and staff sign-in run on Supabase. Requesting, tracking, the driver screens and the admin console still talk to Firebase until their phase.

## Documentation

| Document | Contents |
|---|---|
| [Product Requirements](docs/01-PRD.md) | Users, requirements, scope |
| [App Flow](docs/02-APP-FLOW.md) | Routes, access, request lifecycle, user flows |
| [Tech Stack](docs/03-TECH-STACK.md) | Libraries, backend, what changes and why |
| [Front-end Guidelines](docs/04-FRONTEND-GUIDELINES.md) | Structure, design tokens, coding rules |
| [Backend Schema](docs/05-BACKEND-SCHEMA.md) | Tables, access rules, server functions |
| [Implementation Plan](docs/06-IMPLEMENTATION-PLAN.md) | Phases, checklists, decisions, risks |

## Running locally

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the rebuilt code with Prettier |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:db` | Database access-rule tests on an in-process Postgres |

## Main routes (current)

| Route | Screen |
|---|---|
| `/` | Landing page |
| `/ambulance-booking` | Request an ambulance |
| `/track/:bookingId` | Patient tracking |
| `/hospitals` | Hospital finder (Supabase) |
| `/first-aid-tips`, `/technician-chat` | First aid, chat (mock) |
| `/staff/login` | Sign-in for drivers, technicians and dispatchers (Supabase) |
| `/admin/dispatch`, `/driver`, `/technician` | Role-guarded staff areas (placeholders until their phase) |
| `/driver/register`, `/driver/login`, `/driver/dashboard` … | Older driver app (Firebase) |
| `/admin-login`, `/admin` | Older admin console (Firebase) |

## Secrets

Never commit keys or service account files. Browser configuration lives in `.env.local` (git-ignored); only the Supabase URL and publishable key belong there. See Tech Stack, section 9.
