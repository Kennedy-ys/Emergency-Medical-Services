# EMS Connect Build Status

A running record of what has been built, what was checked and how, what was decided, and what is still open. The plan with its checklists is `06-IMPLEMENTATION-PLAN.md`; this file says where the build actually stands. Add to it at the end of every working session.

## Current phase

Phase 5 (push notifications) is built, switched on for the live project and waiting to be merged (2026-11-10).

| Phase | What | State |
| --- | --- | --- |
| 0 | Make the current state safe | Partly done. Owner items open (see below). |
| 1 | Foundation on Supabase | Done |
| 2 | Core emergency loop | Done. Two-phone and airplane-mode test open. |
| 3 | Admin dispatch console | Done. Some live checks by the owner open. |
| 4 | Patient accounts | Not started. Blocked on choosing an SMS provider. |
| 5 | Push notifications | Built and switched on. PR 5 open. |
| 6 | Technician chat | Not started |
| 7 | Records and pilot hardening | Not started (crew trip records and CSV export were brought forward into Phase 3) |

## Where things are

- Repository: `https://github.com/Kennedy-ys/Emergency-Medical-Services`. Work goes through pull requests into `main`.
- Supabase project: "Emergency Medical Services", reference `kzgwwzpitskmhevbmmkx`. It is the only project so far, used for development and live checks. A separate production project is still to be created before the pilot.
- Stack: React 19, Vite 6, Tailwind 4, React Router 7, TanStack Query 5, React Hook Form with Zod, Leaflet, vite-plugin-pwa, Supabase (Postgres, Auth, Realtime, Edge Functions).
- Checks: `npm run lint`, `npm run format:check`, `npm test`, `npm run test:db`, `npm run build`. CI runs all of them on every pull request.

### Pull requests

| PR | Branch | Contents | State |
| --- | --- | --- | --- |
| 1 | `supabase-migration` | Project docs, removal of the old ambulance module, Phase 1 foundation | Merged 2026-11-10 |
| 2 | `phase-2-emergency-loop` | Request, track, driver screens, offline outbox | Merged 2026-11-10 |
| 3 | `phase-3-admin-dispatch` | Dispatch console, drivers, requests, hospitals | Merged 2026-11-10 |
| 4 | `phase-3-staff-records-reviews` | Reviews, trip records, staff invitations, Firebase removed | Merged 2026-11-10 |
| 5 | `phase-5-push` | Push notifications | Open |

### Deployed to the live Supabase project

| Thing | State |
| --- | --- |
| Migrations `20261109000001` to `20261109000003` (schema, functions, access rules) and the seed | Applied. Verified live on 2026-11-10. |
| Migration `20261110000001_stale_driver_job.sql` | Not confirmed. The owner was to run it in the SQL editor. |
| Migration `20261110000002_push_notifications.sql` | Applied 2026-11-10. Trigger, column and extension confirmed by query. |
| Edge Function `invite-staff` | Deployed, with sign-in checking on |
| Edge Function `push-notify` | Deployed, with sign-in checking off (the database calls it) |
| Function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Set 2026-11-10 |
| `private.push_config` | One row, pointing at `push-notify` |

## Stage log

### Phase 0 and project documents (2026-11-09)

- Wrote the six project documents in `docs/` (requirements, app flow, tech stack, front-end guidelines, backend schema, implementation plan).
- Removed the old `/ambulance` module and the routes that were not going to survive. `/driver` was kept.
- A Firebase service account key had been committed in the old history. The history that is on GitHub does not contain it. Two local branches, `backup/pre-rewrite-main` and `backup/pre-rewrite-supabase-migration`, still do and must never be pushed.

### Phase 1: Foundation on Supabase (2026-11-10)

- Migrations for types, tables, indexes, the new-user trigger, every server function and the access rules for every table.
- Database tests on an in-process Postgres (PGlite), acting as each kind of user. Docker is not installed on the dev machine, so there is no local Supabase stack.
- App foundation: `lib/supabase.js`, `SessionProvider`, `useSession`, `RequireRole`, one route table with lazy-loaded screens, the `components/ui` kit, shared map parts, `useGeolocation`, the offline banner.
- `/staff/login` with role-guarded staff areas. Anonymous sessions through `ensureSession()`.
- CI: lint, format check, unit tests, database tests, build.

### Phase 2: Core emergency loop (2026-11-10)

- `/book`: validated request form, hospital picker from the database, pin adjustment, privacy notice.
- Offline outbox: a request made offline is retried with the same id, so it arrives exactly once.
- `/track/:bookingId`: live status with polling as a fallback, driver card, ambulance position, route, arrival estimate, cancel.
- `/driver`: on-duty switch, location upload every 15 seconds that doubles as the heartbeat, open requests with distance, trip screen with three status buttons and release.
- `/driver/register` and the "being reviewed" state.
- Old Firebase driver, booking and tracking screens removed; their addresses redirect.
- Checked: the full loop was run against the live project by the owner in two browser windows (apply, approve, request, accept, arrive, hospital, complete).

### Phase 3: Admin dispatch console (2026-11-10)

- `/admin/dispatch`: live map, unassigned queue with waiting timers, nearest drivers, assign and reassign, cancel with a reason.
- `/admin/drivers`, `/admin/bookings` with the event timeline, `/admin/hospitals`, `/admin/reviews`, `/admin/records` with CSV download, `/admin/staff`.
- Crew trip record form, shown inside the driver home screen so location sharing carries on while the driver types.
- `invite-staff` Edge Function and `/staff/welcome`, where an invited person chooses a password.
- Landing page reviews read from and sent to Supabase.
- Firebase removed completely: old admin area, its sign-in, the `firebase` package and its cache rule.
- Found by opening the screens against the live project: the dispatch screen failed with "Could not load requests". The requests-to-drivers link had become ambiguous once `booking_declines` existed. Fixed by naming the link (`drivers!bookings_driver_id_fkey`). The mocked tests could not have caught this.
- Checked live: every admin screen loads; a test review was sent, appeared under Waiting and was rejected; `invite-staff` recognises a dispatcher and refuses bad input.

### Phase 5: Push notifications (2026-11-10)

- Proof first: a throwaway Edge Function signed and encrypted a push and reached Google's push service, which proved the `web-push` library works on Supabase. No fallback service is needed.
- A trigger on `booking_events` calls one function, `push-notify`, with the id of the event. The function claims the event once (`notified_at`), decides who to tell, sends, and deletes devices the push service reports as gone.
- Who is told: drivers on duty and free for a new or handed-back request; the patient when an ambulance is assigned or arrives; the other side on a cancellation. No personal details in any notification.
- In the app: "Turn on alerts" card for drivers and for patients on the tracking page, install card for drivers, iPhone Home Screen instructions, service worker handlers in `public/push-sw.js`.
- A device follows whoever is signed in on it (`save_push_subscription`) and is removed at sign-out.
- Setup is written up in `07-PUSH-SETUP.md`; `scripts/setup-push-keys.mjs` creates the keys without showing the private half.
- The installed app is now named "EMS Connect" instead of "EMS PWA".
- Checked: a real notification arrived in desktop Chrome from a preview build. On a real Android phone with the app closed, the notification arrived and tapping it opened the request. The phone test ran against a preview build over USB port forwarding, not the hosted app.

### Test counts

| Date | Unit tests | Database tests |
| --- | --- | --- |
| End of Phase 3 (2026-11-10) | 60 | 15 |
| End of Phase 5 (2026-11-10) | 76 | 17 |

## Decisions

| Decision | Why |
| --- | --- |
| Rebuild on Supabase and Postgres; remove Firebase | Booking rules and access rules live in the database, where a client cannot skip them |
| Keep `/driver`, retire `/ambulance` | One crew app, not two |
| First version includes technician chat, the dispatch console, patient accounts and driver push | Agreed scope for the Calabar pilot |
| Every booking change goes through a server function and writes to `booking_events` | Status rules and the audit trail cannot be bypassed |
| Patients request without an account, on an anonymous session | Nothing stands between a patient and a request |
| Only the publishable key is in the web app; the service role key is used only inside Edge Functions | Server secrets never reach a browser or the repository |
| Screens never import the Supabase client; each feature has an `api.js` | One place per feature for data access |
| Driver sub-screens render inside the driver home page | The heartbeat lives there; leaving it would take the driver off duty |
| Phase 5 before Phase 4 | Phase 4 is blocked on an SMS provider |
| One push function instead of two | New requests and booking changes share the same steps |
| `push-notify` has no password and no sign-in check | It accepts only an event id and claims each event once, so a repeated or made-up call sends nothing |
| No custom notification sound | A web app cannot choose one; the phone's own sound and a vibration pattern are used |
| Push contact address is the repository address | The owner's email was not sent to push services without being asked. Change `VAPID_SUBJECT` to use an email. |

## Known issues and open items

### For the owner

- Revoke the old Firebase service account key in Google Cloud Console.
- Confirm `20261110000001_stale_driver_job.sql` has been run on the live project. Without it, drivers who go quiet are never taken off duty.
- Add `<site address>/staff/welcome` to the redirect addresses in Supabase (Authentication, URL Configuration), then send one real staff invitation and follow it through.
- As a driver, complete a trip, write its record and check it appears at `/admin/records`.
- Try the admin actions that change data against the live project: approve and suspend a driver, assign and cancel a request, add and hide a hospital.
- Repeat the full loop on two real phones, including a request made in airplane mode.
- Repeat the Android push test on the hosted app, built with `VITE_VAPID_PUBLIC_KEY`.
- Choose the SMS provider for Phase 4.
- Create a separate production Supabase project before the pilot, and clear test data (including the "TEST - please ignore" review).
- Give the admin profile a name; it shows as "No name given".

### Product decisions waiting

- A driver who closes the app is taken off duty after two minutes and stops being offered requests, so push only reaches drivers whose app was open recently. Decide whether closed-app drivers should stay on duty longer.
- Whether to reword the request history timeline in dispatcher wording.

### Not built or not verified

- Playwright end-to-end tests. They need a test Supabase project with seeded accounts, which does not exist.
- Push on iPhone has not been tried on a device.
- The hospital list is still the five seeded Calabar hospitals, not an export of the managed list.
- `TechnicianChat` and `FirstAidTips` in `src/pages` are older screens not yet rebuilt.
- Public map tile and routing servers are still used in ways their operators do not allow for production. Phase 7.
- No error reporting service yet. Phase 7.

### Known limits, recorded only

- The database tests run on PGlite, not Supabase. Passing there means the SQL is valid and the rules behave as designed; it does not replace applying the migrations to a real project.
- Unit tests mock Supabase, so a query that the real API rejects can still pass. Every new screen should be opened once against the live project.
- The service worker does not run under `npm run dev`. Anything involving push or offline caching must be tried with `npm run build` and `npm run preview`.
- Running `setup-push-keys.mjs` again with `--force` stops alerts on every device until each one turns them on again.

## Next stage

1. Merge PR 5 once CI is green.
2. Phase 6 (technician chat) can start now. Phase 4 (patient accounts) starts once the SMS provider is chosen.
