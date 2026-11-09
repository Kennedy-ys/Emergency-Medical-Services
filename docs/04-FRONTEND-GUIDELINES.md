# EMS Connect — Front-end Guidelines

Version 1.0 · 2026-11-09

Rules for writing UI code in this project. They exist so the patient app, driver app and admin console look and behave like one product, and so the problems in the current code are not repeated.

## 1. Principles

1. **Emergency first.** The person using this may be frightened and on a bad connection. One primary action per screen, large targets, plain words, no decorative delay before the main action.
2. **Mobile first.** Design at 360 px wide, then widen. Only the admin console is designed desktop first.
3. **Never lose input.** Anything a user submits is either saved on the server or queued on the device, and the screen says which.
4. **The database decides.** The UI hides what a role cannot do, but never relies on hiding for security.

## 2. Folder structure

```
src/
  app/            App.jsx, routes.jsx, providers.jsx, RequireRole.jsx
  features/
    auth/         login screens, session hook
    booking/      request form, hospital picker
    tracking/     patient tracking screen
    driver/       dashboard, requests, trip, profile
    technician/   queue
    chat/         conversation UI shared by patient and technician
    admin/        dispatch, bookings, drivers, hospitals, records, reviews, staff
    hospitals/    public hospital finder
    first-aid/
    landing/
  components/
    ui/           Button, Input, Select, Card, Badge, Dialog, Sheet, Spinner, EmptyState, ErrorState
    map/          BaseMap, markers, RouteLayer, LocationPicker
    layout/       AppShell, DriverLayout, AdminLayout, OfflineBanner
  lib/            supabase.js, queryClient.js, outbox.js, geo.js, push.js, status.js
  hooks/          useSession, useOnline, useGeolocation
  styles/         index.css
```

- A feature folder owns its screens, its components, and an `api.js` holding every database call for that feature.
- **Components never import the Supabase client directly.** They call hooks (`useBooking(id)`, `useAcceptBooking()`) defined beside `api.js`. This is what makes a backend change survivable; today 40+ files call Firebase inline.
- One component per file, PascalCase file name matching the component (`OfflineMap.jsx`, not `offlineMap.jsx`). Hooks and utilities are camelCase.
- No empty files, no second copy of a screen for another role. Share the component and pass props.

## 3. Design tokens

Defined once in `src/styles/index.css` with Tailwind 4 `@theme`, and used through utility classes. The file should contain a single `@import "tailwindcss";` (it currently imports Tailwind three times).

| Token | Value | Use |
|---|---|---|
| `brand` | blue-600 `#2563eb`, hover blue-700, tint blue-50 | Primary actions, links, headers |
| `emergency` | red-600 `#dc2626` | Request ambulance, Call 112, destructive confirmation. Nothing else |
| `success` | green-600 | Completed, available, arrived |
| `warning` | amber-500 | Waiting, offline, pending approval |
| `surface` | white on gray-50 page | Cards and sheets |
| `text` | gray-900 body, gray-600 secondary | Never lighter than gray-600 on white |
| Radius | `rounded-lg` controls, `rounded-xl` cards | |
| Shadow | `shadow-sm` cards, `shadow-lg` overlays | |
| Font | System font stack | No web-font download |

- Sizes: body 16 px minimum (prevents iOS zoom on inputs); screen title `text-2xl font-bold`; section title `text-lg font-semibold`.
- Spacing on the 4 px scale; screen padding `px-4` mobile, `px-6` from `md`.
- Status colours come from one map in `lib/status.js` (status → label, colour, icon). Screens never hard-code a status string or its colour.

## 4. Components

- Build screens from `components/ui`. If a pattern appears twice, it moves there.
- `Button` variants: `primary`, `emergency`, `secondary`, `ghost`; sizes `md` (44 px high) and `lg` (56 px, for the main action on patient and driver screens). Shows a spinner and disables itself while its action is running.
- Inputs always have a visible `<label>`; placeholder text is an example, not the label. Errors appear under the field in words.
- Use the right input type and hints: `type="tel" inputMode="tel" autoComplete="tel"` for phones, `autoComplete="name"` for names.
- Dialogs and menus use Headless UI so focus and Escape work. No `alert()` or `confirm()`.
- Every data-driven view handles four states: loading (skeleton or spinner), empty (what it means and what to do), error (plain message and Retry), and data.

## 5. Data and state

- Server data goes through TanStack Query. No `useEffect` + `useState` fetching in components.
- Query keys are arrays starting with the table: `['bookings', id]`, `['hospitals']`.
- Realtime: subscribe inside the hook, update or invalidate the query cache, unsubscribe on cleanup. Every subscription has a cleanup.
- Changes use mutations; show the result with a toast; disable the trigger while pending.
- Local UI state stays in the component. Session and online status come from context. No global store is needed.
- Status changes go through the server functions (`accept_booking`, `advance_booking`, …), never by writing the status column from the client.
- No hard-coded reference data in components (the hospital list in the current booking page is the example to avoid).

## 6. Maps

- One `BaseMap` component sets tiles, attribution and default view (Calabar). Screens add layers to it.
- Marker icons are defined once in `components/map/markers.js` using bundled images, not URLs to a CDN.
- Coordinates are always `{ lat, lng }` in the UI. The current code mixes `{lat, lng}` with `{latitude, longitude}`; convert at the boundary only.
- Route drawing lives in one `RouteLayer` that removes itself on unmount.
- Location: one `useGeolocation` hook with states `prompt | granted | denied | unavailable`; screens render something useful for each.
- Throttle driver position uploads (see Backend Schema section 6); do not write on every GPS tick.

## 7. Offline and PWA

- `OfflineBanner` appears whenever the browser is offline. It was commented out; restore it.
- Queued items show "Waiting to send" with a count, and clear themselves when sent.
- Any action that needs a connection is disabled offline with a one-line reason.
- Do not cache API responses in the service worker; TanStack Query owns data caching.
- Sounds and images are imported so the bundler fingerprints them (`import sound from './notification.mp3'`); relative string paths break after build.

## 8. Accessibility

- Touch targets at least 44 × 44 px; the main emergency actions 56 px high and full width on mobile.
- Colour is never the only signal: pair status colour with text or an icon.
- Contrast at least 4.5:1 for text.
- Every interactive element is a `<button>` or `<a>` with a name; icon-only buttons have `aria-label`. Do not use a link with `onClick` for an action such as sign-out.
- Status changes on the tracking screen are announced with `aria-live="polite"`.
- Respect `prefers-reduced-motion`; no scroll animations on task screens.

## 9. Writing

- Short, calm, specific: "Ambulance is 4 minutes away", "Could not send. Retrying…".
- Say what happened and what to do next. No error codes, no blame, no emoji in interface text.
- Use the same word for the same thing everywhere: **request** (not booking/order) in patient text, **trip** in driver text, **technician** for the paramedic in chat.
- Phone numbers are tappable `tel:` links.

## 10. Code quality

- ESLint and Prettier clean before commit; no unused imports or commented-out blocks left behind.
- No `console.log` in committed code; real errors go to the monitoring helper.
- No secrets or keys in source. Configuration through `import.meta.env`.
- Lazy-load role areas (`driver`, `technician`, `admin`) and the map so the patient request path stays small.
- A new feature ships with at least one test of its main path.
- Protected screens are wrapped by `RequireRole` in the route table, never by a check inside the page.
