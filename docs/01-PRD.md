# EMS Connect — Product Requirements Document

Version 1.0 · 2026-11-09 · Status: draft for owner review

Related: [App Flow](02-APP-FLOW.md) · [Tech Stack](03-TECH-STACK.md) · [Front-end Guidelines](04-FRONTEND-GUIDELINES.md) · [Backend Schema](05-BACKEND-SCHEMA.md) · [Implementation Plan](06-IMPLEMENTATION-PLAN.md)

## 1. Summary

EMS Connect is an installable web app (PWA) that lets a person in Calabar, Nigeria request an ambulance, watch it arrive on a map, and get first-aid guidance from a paramedic while waiting. Ambulance drivers receive and run trips from the same app, and a dispatcher oversees everything from an admin console.

Version 1 targets a **real pilot in Calabar** with real patients, drivers and hospitals. That makes security, reliability and privacy requirements, not extras.

## 2. Problem

- Calling for an ambulance in Calabar depends on knowing the right number and describing a location by voice.
- The caller has no idea whether help is coming or how far away it is.
- Dispatchers have no shared live picture of which ambulance is free and where.
- Mobile data is unreliable, so an app that only works online fails exactly when it is needed.

## 3. Users

| Role | Who | Main goal |
|---|---|---|
| Patient / requester | Anyone needing an ambulance for themselves or someone else | Get help fast, know when it arrives |
| Driver | Ambulance driver or crew member, approved by the operator | Receive a request, navigate to patient, then hospital |
| Technician | Paramedic answering chats | Give first-aid guidance until the ambulance arrives |
| Admin / dispatcher | Operator staff | See all requests and ambulances, assign, manage data |

## 4. Goals and success measures

Targets are proposals to confirm during the pilot.

| Goal | Measure | Proposed target |
|---|---|---|
| Fast request | Time from opening the app to request sent | Under 60 seconds |
| Fast assignment | Median time from request to a driver assigned | Under 2 minutes |
| No lost requests | Requests that end `completed` or `cancelled` with a reason | 100% |
| Trustworthy tracking | Driver position on patient map no older than | 10 seconds while online |
| Works on poor networks | App shell, first-aid tips and hospital list open offline | Always |

## 5. Scope for version 1

### 5.1 Patient

| ID | Requirement | Priority |
|---|---|---|
| P-1 | Request an ambulance with name, phone, notes, destination hospital and GPS pickup point; no account creation step before the request is sent | Must |
| P-2 | Adjust the pickup point on a map if GPS is wrong or denied | Must |
| P-3 | Live tracking page: status, driver name, phone, plate, driver position, ETA | Must |
| P-4 | Cancel a request until the driver has arrived, with a reason | Must |
| P-5 | If the request cannot be sent (offline), keep it, retry automatically, and show the emergency number 112 prominently | Must |
| P-6 | Account: verify phone number by SMS code, see booking history, re-open an active booking on any device | Must |
| P-7 | Chat with a technician in real time, text and photos | Must |
| P-8 | Find hospitals: nearest first, route, distance, call button | Must |
| P-9 | First-aid tips available offline | Must |
| P-10 | Leave a review after a completed trip | Should |
| P-11 | Push notification when a driver is assigned and when it arrives | Should |

### 5.2 Driver

| ID | Requirement | Priority |
|---|---|---|
| D-1 | Register with personal and vehicle details; cannot work until an admin approves | Must |
| D-2 | Go available / offline; location is shared only while available or on a trip | Must |
| D-3 | See open requests with distance; accept one. Two drivers can never get the same request | Must |
| D-4 | Push notification and sound for new requests, including when the app is closed | Must |
| D-5 | Trip screen: route to patient, then to hospital; buttons for Arrived, Leaving for hospital, Completed | Must |
| D-6 | Release a trip back to the queue with a reason before pickup | Must |
| D-7 | Fill a patient record for the trip, even offline; it syncs later | Should |
| D-8 | Trip history and profile | Should |

### 5.3 Technician

| ID | Requirement | Priority |
|---|---|---|
| T-1 | Queue of waiting conversations; claim one | Must |
| T-2 | Real-time text and image chat; see the patient's active booking if there is one | Must |
| T-3 | Close a conversation | Must |

### 5.4 Admin / dispatcher

| ID | Requirement | Priority |
|---|---|---|
| A-1 | Dispatch console: live map of all active requests and drivers, list of unassigned requests with waiting time | Must |
| A-2 | Assign or reassign a request to a driver; nearest available drivers are suggested | Must |
| A-3 | Cancel any request with a reason | Must |
| A-4 | Approve, suspend and view drivers | Must |
| A-5 | Manage hospitals (add, edit, archive, pick location on map) | Must (exists) |
| A-6 | Moderate reviews | Must (exists) |
| A-7 | View, archive and export patient records | Must (exists) |
| A-8 | Create technician and admin accounts | Must |
| A-9 | Audit trail of every status change on a request | Must |
| A-10 | Automatic assignment to nearest driver if nobody accepts within a set time | Should |

## 6. Non-functional requirements

- **Security:** every table protected by row-level security; a user can only read or change what their role allows. No patient data is publicly listable.
- **Privacy:** collect only what the service needs; consent notice before first request; compliance with the Nigeria Data Protection Act 2023 (privacy policy, a way to request deletion). Needs legal review before pilot.
- **Reliability:** a request is never silently dropped. Offline submissions are queued and de-duplicated on retry.
- **Performance:** usable on a low-end Android phone on 3G. Initial load under 200 KB of JavaScript for the patient request path.
- **Offline:** app shell, first-aid tips, hospital list and the request form load without a connection.
- **Accessibility:** large touch targets, readable contrast, works with screen readers, all actions reachable by keyboard.
- **Devices:** mobile first (Android Chrome primary, iOS Safari supported); admin console is desktop first.

## 7. Out of scope for version 1

Payments or billing, hospital-side accounts and bed availability, voice or video calls in chat, native app-store apps, multi-city or multi-operator support, languages other than English, medical triage scoring.

## 8. What exists today versus this document

| Area | Today | Gap to v1 |
|---|---|---|
| Ambulance request | Works online; anonymous; hospital list hard-coded in the page | Use managed hospitals, pickup adjustment, fix offline path (offline requests are currently saved as patient records and never become bookings) |
| Patient tracking | Page exists but its GPS watcher throws an error on first position | Rebuild |
| Driver app | Register, login, list, accept, tracking page | Approval step, atomic accept, trips never reach `completed`, status names are inconsistent |
| Older `/ambulance` module | Duplicate of driver app, no login protection | Remove |
| Admin | Patient records, map, hospitals, reviews. Any signed-in user, including a self-registered driver, can open `/admin` | Role-based access, dispatch console, driver management |
| Auto-dispatch | Component exists, not used | Replace with server-side logic |
| Technician chat | Hard-coded mock | Build |
| Patient accounts, push | None | Build |
| Patient records | Public form and a public page listing all patients | Restrict to staff, tie to trips |
| Backend | Firebase Realtime Database, no rules file in the repo | Move to Supabase with row-level security |

## 9. Assumptions and open questions

1. **Patient records.** This document assumes the existing patient form becomes a trip record filled by the driver or crew. If it was meant for something else (for example hospital intake), section 5.2 D-7 changes.
2. **SMS provider** for phone verification in Nigeria (Twilio, Vonage, or Termii through a custom hook) and who pays for it.
3. **Who are technicians** in the pilot, and what hours is chat staffed? The app must say so when nobody is available.
4. **Operator details:** how many ambulances, which hospitals, who dispatches.
5. **Map and routing provider** for production (see Tech Stack section 6); the free public servers used now are not permitted for production traffic.
6. **Hosting and domain** for the pilot.
