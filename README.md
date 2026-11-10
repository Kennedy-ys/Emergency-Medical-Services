# EMS Connect

An installable web app (PWA) for requesting an ambulance in Calabar, Nigeria: patients request and track an ambulance, drivers receive and run trips, and dispatchers oversee everything from an admin console.

## Status

The app is being rebuilt for a real pilot and now runs entirely on Supabase; Firebase has been removed. Work follows the implementation plan below. Phases 1 to 3 are in place: requesting and tracking, the driver screens and the dispatcher console. Push notifications (Phase 5) are built and need switching on per project: see `docs/07-PUSH-SETUP.md`. Patient accounts and technician chat come next.

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
| `/book` | Request an ambulance (works offline: the request is held and sent once) |
| `/track/:bookingId` | Patient tracking |
| `/hospitals` | Hospital finder (Supabase) |
| `/first-aid-tips`, `/technician-chat` | First aid, chat (mock) |
| `/staff/login` | Sign-in for drivers, technicians and dispatchers (Supabase) |
| `/driver` | Driver: go on duty, accept requests, run a trip |
| `/driver/register` | Driver application (approved by a dispatcher) |
| `/admin/dispatch` | Dispatcher: live map, waiting requests, assign and cancel |
| `/admin/bookings`, `/admin/drivers`, `/admin/hospitals` | Dispatcher: request history, driver approval, hospital list |
| `/admin/records`, `/admin/reviews`, `/admin/staff` | Dispatcher: crew trip records, review moderation, staff invitations |
| `/staff/welcome` | Where an invitation email lands: choose a password |
| `/technician` | Technician area (placeholder until its phase) |

## Secrets

Never commit keys or service account files. Browser configuration lives in `.env.local` (git-ignored); only the Supabase URL and publishable key belong there. See Tech Stack, section 9.
