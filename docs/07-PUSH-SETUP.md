# Push notifications: how they work and how to switch them on

## What is sent

| When | Who is told | Opens |
|---|---|---|
| A new request arrives | Approved drivers who are on duty and free | `/driver` |
| A driver hands a request back | The same drivers (except those who passed on it), and the patient | `/driver`, `/track/:id` |
| A driver accepts | The patient | `/track/:id` |
| A dispatcher assigns a trip | The patient and that driver | `/track/:id`, `/driver` |
| The ambulance arrives | The patient | `/track/:id` |
| A request is cancelled | The other side, never the person who cancelled | `/track/:id`, `/driver` |

Notifications show on a locked screen, so they never contain a name, a phone number or the reason for the call. The wording lives in `supabase/functions/push-notify/messages.js` and is unit-tested.

## How it works

1. Every change to a booking already writes a row to `booking_events`.
2. A trigger on that table (`booking_events_push`) asks the `push-notify` Edge Function to announce it, passing only the id of the event. The request is made by `pg_net` after the change is saved, so a booking can never fail because of a notification.
3. `push-notify` claims the event by setting `booking_events.notified_at`. Only the first call gets it, so a repeated or made-up call sends nothing; that is why the function needs no password. It then reads the booking, decides who to tell, and sends to each of their devices in `push_subscriptions`.
4. Devices that the push service reports as gone (answers 404 or 410) are deleted.
5. In the browser, `public/push-sw.js` (loaded into the service worker) shows the notification and, when it is tapped, opens the app on the right screen.

A device is subscribed from the "Turn on alerts" card: on the driver home screen, and on the tracking page for patients. `save_push_subscription` moves a device to whoever is signed in on it now; signing out removes it.

## Switching it on for a Supabase project

Do these once per project, in this order, from the project folder. Replace `<ref>` with the project reference.

1. Create the signing keys. The private half goes straight into the project's secrets and is never shown; the public half is written to `.env.local`.

   ```bash
   node scripts/setup-push-keys.mjs <ref> mailto:someone@example.org
   ```

   The address is a contact for the push services (Google, Apple, Mozilla). Use one that is read.

2. Apply the database change.

   ```bash
   npx supabase db query --remote=<ref> --file supabase/migrations/20261110000002_push_notifications.sql
   ```

3. Deploy the function. It must be deployed without sign-in checking, because the database calls it.

   ```bash
   npx supabase functions deploy push-notify --remote=<ref> --no-verify-jwt --use-api
   ```

4. Tell the database where the function is.

   ```bash
   npx supabase db query --remote=<ref> "insert into private.push_config (function_url) values ('https://<ref>.supabase.co/functions/v1/push-notify') on conflict (id) do update set function_url = excluded.function_url"
   ```

5. Wherever the app is built for hosting, set `VITE_VAPID_PUBLIC_KEY` to the value now in `.env.local`, and rebuild.

To switch pushes off again without removing anything: `delete from private.push_config`.

## Trying it

Push needs the service worker, which the development server does not run. Use a build:

```bash
npm run build
```

```bash
npm run preview
```

Open the address it prints in Chrome, sign in as an approved driver, go on duty and choose "Turn on alerts". From another browser (or a private window), request an ambulance. The notification should arrive within a few seconds, including with the driver tab closed.

On a real Android phone the app must be served over https, so this test needs the hosted app.

## Things to know

- **iPhone and iPad:** push only works after the app is added to the Home Screen (Share, then "Add to Home Screen") and opened from there, on iOS 16.4 or later. The alerts card explains this when it applies.
- **Sound:** a web app cannot choose the notification sound. The phone plays its own notification sound and, on Android, the vibration pattern set in `push-sw.js`. Drivers should keep notification volume up and battery saving off for the browser.
- **Timing:** a new-request push is kept by the push service for at most two minutes. A phone that was unreachable for longer does not get a stale offer.
- **New keys:** running `setup-push-keys.mjs` again with `--force` stops alerts on every device until each one turns them on again.
- **Checking deliveries:** the function's logs are in the Supabase dashboard under Edge Functions, `push-notify`. The requests the database made are in the table `net._http_response`.
