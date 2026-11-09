# EMS Connect

An installable web app (PWA) for requesting an ambulance in Calabar, Nigeria: patients request and track an ambulance, drivers receive and run trips, and dispatchers oversee everything from an admin console.

## Status

The app is being rebuilt for a real pilot and moved from Firebase to Supabase. Work happens on the `supabase-migration` branch and follows the implementation plan below. Until Phase 1 lands, the code still talks to Firebase Realtime Database.

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
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run ESLint |

## Main routes (current)

| Route | Screen |
|---|---|
| `/` | Landing page |
| `/ambulance-booking` | Request an ambulance |
| `/track/:bookingId` | Patient tracking |
| `/locate-hospitals`, `/first-aid-tips`, `/technician-chat` | Hospitals, first aid, chat (mock) |
| `/driver/register`, `/driver/login`, `/driver/*` | Driver app |
| `/admin-login`, `/admin/*` | Admin console |

## Secrets

Never commit keys or service account files. Browser configuration will move to `.env.local` in Phase 1 (see Tech Stack, section 9).
