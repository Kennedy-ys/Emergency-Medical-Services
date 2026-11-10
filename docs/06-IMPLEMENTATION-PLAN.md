# EMS Connect — Implementation Plan

Version 1.0 · 2026-11-09

How to get from the current code to the pilot described in the [PRD](01-PRD.md). Phases are ordered so that the app is demonstrable end to end as early as possible (end of phase 2) and each later phase adds one capability.

Sizes are relative effort for one developer: **S** a few days, **M** about a week, **L** two weeks or more. They are estimates, not commitments.

## Starting point

About 7,800 lines of React across 60 files, all talking directly to Firebase Realtime Database. Known problems the plan resolves:

| # | Problem | Where | Fixed in |
|---|---|---|---|
| 1 | Firebase service account key is in git history | commit `658c5a4`, `set-admin-claim/serviceAccountKey.json` | Phase 0 |
| 2 | No database rules in the repo; live rules unknown | Firebase console | Phase 0 |
| 3 | Any signed-in user (including a self-registered driver) can open `/admin` | `ProtectedRoute` in `src/App.jsx:53` checks only "signed in" | Phase 1 |
| 4 | Admin check on the hospital page never fires: it tests `!isAdmin` on an object | `src/admin/AdminHospitalManager.jsx:63` | Phase 1 |
| 5 | Patient data publicly listed | `/patients` route | Phase 0 |
| 6 | Unprotected staff pages | `/ambulance/*`, `/profile/:ambulanceId`, `/mock-ambulance` | Phase 0 |
| 7 | Patient tracking crashes on first GPS fix (assignment to undeclared variables), and overwrites the pickup point with a different shape | `src/pages/LiveTrackingPage.jsx:138` | Phase 2 |
| 8 | Offline ambulance requests are stored as patient records and never become requests | `src/pages/AmbulanceBooking.jsx:126` | Phase 2 |
| 9 | Two drivers can accept the same request | `src/driver/DriverBookings.jsx:116` | Phase 2 |
| 10 | Trips never reach `completed`; status names inconsistent | driver pages | Phase 2 |
| 11 | Hospital list hard-coded in the request page while admins manage a different list | `src/pages/AmbulanceBooking.jsx:33` | Phase 2 |
| 12 | Notification sound path breaks after build | `src/driver/DriverBookings.jsx:108` | Phase 5 |
| 13 | Public map tile and routing servers used in ways their operators prohibit | `vite.config.js`, `generateTiles.cjs` | Phase 7 |

---

## Phase 0 — Make the current state safe (S)

Do this before any new work; it does not depend on the migration.

- [ ] Revoke the leaked service account key in Google Cloud Console (IAM → Service Accounts → Keys). Check whether the repository has ever been pushed to a public remote.
- [ ] Open the Firebase console and check the Realtime Database rules. If they allow public read or write, lock them down or take the database offline until cutover.
- [ ] Commit or discard the three uncommitted changes; create a `supabase-migration` branch.
- [ ] Remove routes and files that will not survive: `/patients`, `/form`, `/map`, `/protocols`, `/mock-ambulance`, `/ambulance/*`, `/profile/:ambulanceId`, `src/ambulance/`, `src/pages/AmbulanceLogin.jsx`, `BookingTracker.jsx`, `BookingPage.jsx`, `userLocationTracker.jsx`, `MockAmbulanceUpdater.jsx`, `src/routes/AppRoutes.jsx`, `src/firebase/`, `src/services/bookingService.js`, `src/components/forms/BookingForm.jsx`, `AmbulanceLocationUpdater.jsx`, the empty `components/context/HospitalSelect.jsx`, `set-admin-claim/`.
- [ ] Replace the template `README.md` with setup instructions and links to these documents.

**Done when:** the leaked key is dead, the old database is not publicly writable, and the app still builds with the removed routes gone.

## Phase 1 — Foundation on Supabase (L)

- [x] Create the Supabase project; apply the migrations and seed; enable anonymous sign-ins. Verified live on 2026-11-10. Still to do: a separate production project before the pilot. *(Owner creates the project. Docker is not installed on the dev machine, so there is no local Supabase stack; the database tests run on an in-process Postgres instead.)*
- [x] Migrations in `supabase/migrations/`: types, tables, indexes, `handle_new_user` trigger, all server functions (including the Phase 2 booking functions).
- [x] Access rules for every table, with tests that act as each role (`npm run test:db`, 15 passing).
- [x] Seed script: the five Calabar hospitals from the old booking page. Still to do: replace with an export of the managed list from Firebase.
- [x] Add `@supabase/supabase-js`, TanStack Query; `.env.example`.
- [x] Add React Hook Form, Zod, Prettier, Vitest; remove unused packages (Tech Stack section 2). Prettier covers the rebuilt folders only; older screens are formatted when they are rebuilt.
- [x] `lib/supabase.js`, `SessionProvider`, `useSession`, `RequireRole`, wired into the app.
- [x] Target layout in place (`src/app`, `features`, `components/{ui,map,layout}`, `lib`, `hooks`, `styles`); providers wired; one route table (`src/app/routes.jsx`) with lazy-loaded screens. Older Firebase screens stay in `src/pages`, `src/driver` and `src/admin` until the phase that rebuilds them, rather than being moved twice.
- [x] Design tokens and the `components/ui` kit (Button, Field, Card, Spinner, loading/empty/error states); `BaseMap`, `RouteLayer`, `FitBounds`, markers, `useGeolocation`, `OfflineBanner`. Select, Badge, Dialog and Sheet are added when a screen first needs them.
- [x] `/staff/login` on Supabase with role-guarded `/admin/dispatch`, `/driver`, `/technician` (placeholder pages). Anonymous sign-in is available as `ensureSession()` and is first used by the request form in Phase 2.
- [ ] Owner: create the first admin account in the Supabase dashboard and promote it with the SQL in `supabase/seed.sql`; sign in at `/staff/login` to confirm.
- [x] CI: lint, format check, unit tests, database tests, build (`.github/workflows/ci.yml`).

**Done when:** a seeded admin and a seeded driver can sign in and each reaches only their own area; a signed-out visitor sees the landing page and the hospital list from Supabase; RLS tests pass.

## Phase 2 — Core emergency loop (L)

The product's reason to exist. PRD: P-1 to P-5, D-2, D-3, D-5, D-6.

- [x] Functions: `request_booking`, `accept_booking`, `decline_booking`, `release_booking`, `advance_booking`, `cancel_booking`, `set_availability`, `nearest_hospitals`; database tests including the two-drivers race (`npm run test:db`).
- [x] `/book`: validated form, hospital picker from the database, pin adjustment, privacy notice. Checked in the browser against the live project on 2026-11-10 (request sent, then cancelled).
- [x] Offline outbox for requests with `client_request_id`; "Not sent yet" state with Call 112. Covered by unit tests (same id on every retry, one shared attempt); not yet tried on a real phone in airplane mode.
- [x] `/track/:bookingId`: realtime status with polling as a fallback, driver card, driver position, route, ETA, cancel. Checked against the live project.
- [x] Driver (`/driver`): availability toggle, location upload every 15 seconds that doubles as the heartbeat, open requests with distance, trip screen with the three status buttons and release. Built, unit-tested and run against the live project.
- [x] Driver application at `/driver/register` and the "being reviewed" state, brought forward from Phase 3 so a driver account can exist. Until `/admin/drivers` is built, approve with the SQL in `supabase/seed.sql`.
- [x] `mark-stale-drivers` job: `supabase/migrations/20261110000001_stale_driver_job.sql`. Owner: run it once in the Supabase SQL editor.
- [x] `lib/status.js` as the single source of labels and colours.
- [x] Old Firebase driver app, booking page and tracking page removed; their addresses redirect to the new screens.
- [x] Full loop run against the live project by the owner on 2026-11-10: driver application and approval, request, accept, arrive, hospital, complete, with the patient and driver screens staying in step. Run in two browser windows on one machine.
- [ ] Owner: repeat on two real phones, including a request made in airplane mode.
- [ ] Playwright test: request → accept → arrive → hospital → complete, and request → cancel. Not started: it needs a test Supabase project with seeded accounts, which does not exist yet.

**Done when:** on two phones, a patient requests, a driver accepts and completes the trip, both screens stay in step throughout, and a request made in airplane mode is delivered exactly once when the connection returns.

## Phase 3 — Admin dispatch console (M)

PRD: A-1 to A-9, D-1.

- [x] `register_driver`, driver application screen and "awaiting approval" state (done in Phase 2).
- [x] `/admin/drivers`: approve, turn down, suspend with a reason, reinstate.
- [x] `/admin/dispatch`: live map of requests and on-duty ambulances, unassigned queue with waiting timers (called out after 2 minutes), `nearest_drivers`, `assign_booking` (assign and reassign), cancel with a reason.
- [x] `/admin/bookings` list with filters, and detail with the `booking_events` timeline.
- [x] Hospitals at `/admin/hospitals` on Supabase (add, edit, hide from patients); the old Firebase hospital manager is removed.
- [ ] Owner: create the first admin account (see Phase 1), sign in at `/staff/login` and try each admin screen. They are covered by unit tests with a mocked server but **have not been opened against the live project**.
- [ ] Port the reviews and patient records screens to Supabase behind the admin role. Still on Firebase at `/admin`.
- [ ] `invite-staff` function and `/admin/staff`. Needs a server-side function holding the service role key.

**Done when:** a new driver cannot see requests until approved; a dispatcher can assign and reassign a waiting request and sees every change in the timeline.

## Phase 4 — Patient accounts (M)

PRD: P-6, P-10.

- [ ] Choose and configure the SMS provider; test on the four Nigerian networks.
- [ ] `/login` with SMS code; upgrade of the anonymous session so existing requests stay attached.
- [ ] `/account`: profile, history, sign out, delete my data.
- [ ] Review prompt after a completed trip.
- [ ] Rate limits on code requests.

**Done when:** a patient who requested anonymously verifies their number and sees that request in their history on a second device.

## Phase 5 — Push notifications (M)

PRD: D-4, P-11.

- [ ] Proof of concept: send one Web Push from an Edge Function. If the library does not work on Deno, fall back to a small Node service or Firebase Cloud Messaging for delivery only.
- [ ] VAPID keys; service worker push and notification-click handlers; permission prompt at the right moment; `push_subscriptions` storage.
- [ ] `notify-new-booking`, `notify-booking-change`; cleanup of dead subscriptions.
- [ ] Install prompt for drivers; iPhone instructions (must add to Home Screen).
- [ ] Bundle the notification sound correctly.

**Done when:** a driver with the app closed on Android receives a new-request notification within about 10 seconds and tapping it opens the request.

## Phase 6 — Technician chat (M)

PRD: P-7, T-1 to T-3.

- [ ] `claim_conversation`, `close_conversation`; storage bucket and its policies.
- [ ] Shared conversation component: realtime messages, image upload with client-side resize, read state.
- [ ] Patient `/chat`, technician `/technician` queue and conversation with the linked-request panel.
- [ ] `notify-new-conversation`; "no technician available" state.

**Done when:** a patient and a technician exchange text and a photo in real time, and a third user cannot read the conversation.

## Phase 7 — Records and pilot hardening (M–L)

- [ ] Trip record form for drivers with offline outbox (D-7); admin export.
- [ ] Production map tiles and routing provider; remove the bulk tile precache scripts.
- [ ] Sentry; friendly error boundary.
- [ ] Accessibility pass and low-end Android test on throttled 3G; bundle size check.
- [ ] Privacy policy, consent text and retention settings reviewed against the Nigeria Data Protection Act.
- [ ] Security review: re-run RLS tests, try each role against every table, check storage policies, rate limits.
- [ ] Auto-assign job (A-10) if time allows.
- [ ] Database backups confirmed; a written runbook for "the app is down" (fallback to phone dispatch).
- [ ] Staging rehearsal with real drivers and a dispatcher; fix what they trip on.
- [ ] Production deploy on the pilot domain; delete the Firebase project.

**Done when:** the rehearsal runs a full shift of test requests without a lost or stuck request, and the items above are ticked.

---

## Order and dependencies

```
0 ─▶ 1 ─▶ 2 ─▶ 3 ─▶ 7
              ├─▶ 4
              ├─▶ 5
              └─▶ 6
```

Phases 4, 5 and 6 are independent of each other once phase 2 is done; do them in whichever order the pilot partner values most. Phase 7 comes last because it tests everything.

## Decisions needed from the owner

| Decision | Needed by |
|---|---|
| Confirm patient records are crew trip records (PRD section 9, item 1) | Phase 3 |
| Supabase region and plan | Phase 1 |
| Hosting and domain | Phase 1 |
| SMS provider and budget | Phase 4 |
| Map tile and routing provider | Phase 7 (earlier is better) |
| Pilot operator details: ambulances, hospitals, dispatch staff, chat hours | Phase 3 |
| Legal review of privacy text | Phase 7 |

## Risks

| Risk | Mitigation |
|---|---|
| The rewrite is large; every data call changes | Phase 0 deletes about a third of the code first; feature `api.js` files keep database calls in one place |
| Web Push from Edge Functions may not work out of the box | Proof of concept at the start of phase 5 with a named fallback |
| iPhone drivers will not get closed-app alerts unless they install the app | Onboarding step; recommend Android for pilot drivers |
| SMS codes not arriving on some networks | Test all four networks; anonymous requests keep working without verification |
| GPS inaccuracy indoors | Pin adjustment; driver can call the patient |
| Free-tier limits on Supabase, maps or SMS during the pilot | Check quotas against expected volume before launch; budget for paid tiers |
| One developer, safety-critical product | Automated end-to-end test of the core loop, staging rehearsal, phone-dispatch fallback documented |
