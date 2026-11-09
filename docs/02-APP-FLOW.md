# EMS Connect — App Flow

Version 1.0 · 2026-11-09

Describes every screen, who can open it, and how users move between them. Requirement IDs (P-1, D-3 …) refer to the [PRD](01-PRD.md).

## 1. Route map

| Route | Screen | Access | Replaces (current code) |
|---|---|---|---|
| `/` | Landing: request button, services, reviews | Public | `pages/Home.jsx` |
| `/first-aid` | First-aid tips (offline) | Public | `pages/FirstAidTips.jsx` |
| `/hospitals` | Find hospitals | Public | `pages/LocateHospitals.jsx` |
| `/book` | Request an ambulance | Public (silent anonymous session) | `pages/AmbulanceBooking.jsx` |
| `/track/:bookingId` | Live tracking | Booking owner | `pages/LiveTrackingPage.jsx` |
| `/login` | Phone number + SMS code | Public | new |
| `/account` | Profile, booking history | Patient (verified) | new |
| `/chat` | Start or resume a chat | Patient | `pages/TechnicianChat.jsx` (mock) |
| `/chat/:conversationId` | Conversation | Participants | new |
| `/staff/login` | Email + password for driver, technician, admin | Public | `driver/DriverLogin.jsx`, `pages/AdminLogin.jsx` |
| `/driver/register` | Driver application | Public | `driver/DriverRegistration.jsx` |
| `/driver` | Dashboard, availability toggle | Driver (approved) | `driver/DriverDashboard.jsx` |
| `/driver/requests` | Open requests | Driver (approved) | `driver/DriverBookings.jsx` |
| `/driver/trip/:bookingId` | Active trip | Assigned driver | `driver/DriverTrackingPage.jsx` |
| `/driver/trip/:bookingId/record` | Patient record form | Assigned driver | `pages/PatientForm.jsx` |
| `/driver/history`, `/driver/profile` | History, profile | Driver | `driver/DriverProfile.jsx` |
| `/technician` | Chat queue | Technician | new |
| `/technician/chat/:conversationId` | Conversation | Technician | new |
| `/admin` | Overview counts | Admin | `admin/AdminDashboard.jsx` |
| `/admin/dispatch` | Live map + unassigned queue | Admin | `admin/MapView.jsx`, `admin/AdminAutoDispatch.jsx` |
| `/admin/bookings`, `/admin/bookings/:id` | All requests, detail with audit trail | Admin | new |
| `/admin/drivers` | Approve, suspend | Admin | new |
| `/admin/hospitals` | Manage hospitals | Admin | `admin/AdminHospitalManager.jsx` |
| `/admin/records` | Patient records, archive, export | Admin | `admin/PatientTable.jsx`, `ArchivedPatientsTable.jsx` |
| `/admin/reviews` | Moderate reviews | Admin | `admin/ReviewModeration.jsx` |
| `/admin/staff` | Create technician and admin accounts | Admin | new |

**Removed:** `/ambulance/*`, `/profile/:ambulanceId`, `/mock-ambulance`, `/patients`, `/form`, `/map`, `/protocols`, `/admin/sync`.

**Guards.** One `RequireRole` wrapper decides access from the signed-in user's role in the database. Wrong role or signed out sends the user to the matching login. A driver whose approval is `pending` or `suspended` sees a status screen instead of the driver app.

## 2. Request lifecycle

One status field drives every screen.

```
pending ──accept / assign──▶ assigned ──arrived──▶ arrived_at_patient
   │                            │                         │
   │                            └─release (back to pending)│ leave for hospital
   ▼                            ▼                         ▼
cancelled ◀──────────────── cancelled          en_route_to_hospital ──▶ completed
```

| Status | Who moves it forward | Patient sees | Driver sees |
|---|---|---|---|
| `pending` | Driver accepts, or admin assigns | "Finding an ambulance", cancel button, 112 fallback | Request in open list |
| `assigned` | Driver taps Arrived | Driver card, live position, ETA, cancel | Route to patient |
| `arrived_at_patient` | Driver taps Leaving for hospital | "Ambulance has arrived" | Patient details |
| `en_route_to_hospital` | Driver taps Completed | Route to hospital | Route to hospital |
| `completed` | — | Summary, review prompt | Record prompt, back to available |
| `cancelled` | — | Reason, request again | Notice, back to available |

Rules: patients may cancel in `pending` and `assigned`; drivers may release in `assigned`; admins may cancel or reassign any time before `completed`. A patient has one active request at a time; a driver has one active trip at a time.

## 3. Patient flows

### 3.1 Request an ambulance (P-1, P-2, P-5)

1. Landing → **Request ambulance**. The app silently creates an anonymous session so the request belongs to this device.
2. If the user already has an active request, go straight to its tracking page.
3. `/book` asks for location permission.
   - Granted: map centres on the user with a draggable pin.
   - Denied or unavailable: map opens on Calabar; user must place the pin; a note explains why.
4. User enters name and phone (prefilled when known), picks a hospital (nearest first, or "nearest available"), adds optional notes, and accepts the privacy notice on first use.
5. Submit:
   - Online → request saved → `/track/:bookingId`.
   - Offline or failed → request stored on the device with a unique ID, screen shows "Not sent yet — retrying" plus a **Call 112** button. It sends automatically when the connection returns; the unique ID prevents duplicates.

### 3.2 Track (P-3, P-4)

- Header shows status in words; map shows patient pin, driver, hospital and the current leg of the route.
- Driver card: name, photo, plate, call button.
- Cancel opens a reason sheet.
- In `pending` longer than 3 minutes: show "Still looking" with **Call 112** and **Chat with a technician**.
- Reopening the app with an active request lands here.

### 3.3 Account (P-6)

- `/login`: phone number → SMS code → the anonymous session is upgraded, so existing requests stay attached.
- Prompted, not forced, after the first request is sent ("Verify your number to keep your history").
- `/account`: name, phone, past requests, sign out, delete my data.

### 3.4 Chat (P-7)

1. `/chat` → **Start chat**, optionally linked to the active request.
2. Conversation is `open` and unclaimed; patient sees "Waiting for a technician". Technicians get a push notification.
3. Technician claims it; both sides exchange text and photos in real time.
4. Either side closes it. If no technician is online, the screen says so and points to first-aid tips and 112.

### 3.5 Hospitals, first aid, reviews

- `/hospitals`: list sorted by distance, map, route, call. Works from cache offline, without routing.
- `/first-aid`: static content bundled with the app.
- After `completed`: star rating and comment → `pending` until an admin approves → shown on landing.

## 4. Driver flows

1. **Register** (`/driver/register`) → "Application received" screen. Admin approves (A-4).
2. **Sign in** (`/staff/login`) → `/driver`. First visit asks for location and notification permission, and offers to install the app.
3. **Go available.** Location starts uploading. Going offline or signing out stops it. If the connection drops for more than 2 minutes the driver is shown as offline to dispatch.
4. **Receive.** New request → push notification and sound → `/driver/requests` shows open requests with distance. Accept is decided on the server; the loser of a race sees "Already taken".
5. **Trip** (`/driver/trip/:bookingId`): route to patient → **Arrived** → **Leaving for hospital** → **Completed**. **Release** (before arrival) asks for a reason and returns the request to the queue. If the patient or admin cancels, the driver is notified and returned to available.
6. **Record** (optional, D-7): patient details form; saved on the device if offline and synced later.

## 5. Technician flow

`/staff/login` → `/technician` queue (waiting first, then mine) → claim → chat → close. Linked request details appear in a side panel.

## 6. Admin flows

- **Dispatch** (`/admin/dispatch`): map with all active requests and all online drivers. Left panel: unassigned requests, oldest first, with a waiting timer that turns red after 2 minutes. Selecting one lists the nearest available drivers; **Assign** sends it to that driver. Assigned requests can be reassigned or cancelled.
- **Bookings**: searchable table, filters by status and date; detail page shows the full timeline of status changes with who made each one.
- **Drivers**: tabs for pending, approved, suspended; approve or suspend with a note.
- **Hospitals, Records, Reviews**: as today, behind the admin role.
- **Staff**: invite a technician or admin by email.

## 7. Cross-cutting behaviour

| Situation | Behaviour |
|---|---|
| Offline | Thin banner at top. Reads come from cache. Requests and patient records queue and sync; chat sending is disabled with an explanation |
| Location denied | Patient can place the pin by hand. Driver cannot go available until it is granted |
| Notifications denied | In-app sound and banner still work; driver sees a warning that closed-app alerts are off |
| Session expired | Return to the right login, then back to the page they were on |
| Not found or no access | One "Not available" page with a link home; never reveal whether the record exists |
| Errors | Toast with a plain message and a retry; details go to error monitoring |
| Install | Install prompt offered to drivers after first sign-in and to patients after first completed request |
