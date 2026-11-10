// Database tests: applies the migrations to an in-process Postgres (PGlite)
// and checks the booking rules and access rules as each kind of user.
// Run with: npm run test:db
//
// PGlite is not Supabase. The preamble below stands in for the parts Supabase
// provides (roles, the auth schema, default grants). Passing here means the
// SQL is valid and the rules behave as designed; it does not replace applying
// the migrations to a real Supabase project.

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SUPABASE_STANDIN = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    phone text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;

  -- Supabase grants everything by default; the migrations must take it back.
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

  create publication supabase_realtime;
`;

const db = new PGlite();
await db.exec(SUPABASE_STANDIN);

const migrationsDir = path.join(root, 'migrations');
for (const file of readdirSync(migrationsDir).sort()) {
  await db.exec(readFileSync(path.join(migrationsDir, file), 'utf8'));
}
await db.exec(readFileSync(path.join(root, 'seed.sql'), 'utf8'));

// ------------------------------------------------------------------ helpers

async function createUser(role = 'patient', name = role) {
  const { rows } = await db.query(
    `insert into auth.users (raw_user_meta_data) values ($1) returning id`,
    [{ full_name: name }],
  );
  const id = rows[0].id;
  if (role === 'admin' || role === 'technician') {
    await db.query(`update public.profiles set role = $1 where id = $2`, [role, id]);
  }
  return id;
}

/** Runs queries as a signed-in user (or signed out when userId is null). */
async function as(userId, fn, claims = {}) {
  const jwt = userId ? JSON.stringify({ sub: userId, ...claims }) : '';
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [jwt]);
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  try {
    return await fn({
      rows: async (sql, params) => (await db.query(sql, params)).rows,
      one: async (sql, params) => (await db.query(sql, params)).rows[0],
      rpc: async (name, args = []) => {
        const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
        return (await db.query(`select * from public.${name}(${placeholders})`, args)).rows[0];
      },
    });
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

async function fails(promise, pattern) {
  await assert.rejects(promise, (err) => {
    assert.match(err.message, pattern, `unexpected error: ${err.message}`);
    return true;
  });
}

async function approvedDriver(admin, name) {
  const id = await createUser('patient', name);
  await as(id, (q) => q.rpc('register_driver', [name, '0800000000', 'AMB-1', 'CAL-123']));
  await as(admin, (q) => q.rpc('set_driver_approval', [id, 'approved', null]));
  await as(id, (q) => q.rpc('set_availability', [true]));
  return id;
}

const CALABAR = [4.9757, 8.3417];

function request(patient, clientId = randomUUID(), hospital = null) {
  return as(patient, (q) =>
    q.rpc('request_booking', [clientId, 'Ada Obi', '08030000000', ...CALABAR, hospital, 'chest pain', null]),
  );
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ------------------------------------------------------------------ tests

const admin = await createUser('admin');

test('signed-out visitors read hospitals but not bookings', async () => {
  await as(null, async (q) => {
    assert.equal((await q.rows(`select * from public.hospitals`)).length, 5);
    await fails(q.rows(`select * from public.bookings`), /permission denied/);
    await fails(q.rows(`select * from public.profiles`), /permission denied/);
  });
});

test('nearest_hospitals is ordered by distance', async () => {
  const rows = await as(null, (q) =>
    q.rows(`select name, distance_m from public.nearest_hospitals($1, $2, 3)`, CALABAR),
  );
  assert.equal(rows.length, 3);
  assert.ok(rows[0].distance_m <= rows[1].distance_m && rows[1].distance_m <= rows[2].distance_m);
  assert.ok(rows[0].distance_m > 100 && rows[0].distance_m < 10000);
});

test('a new user gets a patient profile and cannot promote themself', async () => {
  const user = await createUser();
  await as(user, async (q) => {
    const me = await q.one(`select role, full_name from public.profiles`);
    assert.deepEqual(me, { role: 'patient', full_name: 'patient' });
    await fails(q.rows(`update public.profiles set role = 'admin'`), /permission denied/);
    await q.rows(`update public.profiles set full_name = 'New Name'`);
  });
});

test('request: retry returns the same row, a second request is refused', async () => {
  const patient = await createUser();
  const clientId = randomUUID();
  const first = await request(patient, clientId);
  const retry = await request(patient, clientId);
  assert.equal(first.status, 'pending');
  assert.equal(retry.id, first.id);
  await fails(request(patient), /active_request_exists/);
  // Someone else replaying the same client id learns nothing.
  await fails(request(await createUser(), clientId), /not_allowed/);
  await as(patient, (q) => q.rpc('cancel_booking', [first.id, 'test']));
});

test('bookings cannot be written directly', async () => {
  const patient = await createUser();
  const booking = await request(patient);
  await as(patient, async (q) => {
    await fails(q.rows(`update public.bookings set status = 'completed'`), /permission denied/);
    await fails(q.rows(`delete from public.bookings`), /permission denied/);
    await fails(
      q.rows(`insert into public.booking_events (booking_id, to_status) values ($1, 'completed')`, [booking.id]),
      /permission denied/,
    );
  });
  await as(patient, (q) => q.rpc('cancel_booking', [booking.id, null]));
});

test('drivers need approval before they see or accept requests', async () => {
  const patient = await createUser();
  const booking = await request(patient);
  const driver = await createUser();
  await as(driver, (q) => q.rpc('register_driver', ['Pending Driver', '0801', 'AMB-9', 'CAL-9']));

  await as(driver, async (q) => {
    assert.equal((await q.rows(`select * from public.bookings`)).length, 0);
    await fails(q.rpc('accept_booking', [booking.id]), /driver_not_available/);
    await fails(q.rpc('set_availability', [true]), /not_approved/);
    await fails(q.rpc('set_driver_approval', [driver, 'approved', null]), /not_allowed/);
    await fails(q.rows(`update public.drivers set approval_status = 'approved'`), /permission denied/);
  });
  await as(patient, (q) => q.rpc('cancel_booking', [booking.id, null]));
});

test('anonymous sessions cannot register as drivers', async () => {
  const anon = await createUser();
  await fails(
    as(anon, (q) => q.rpc('register_driver', ['X', '1', 'A', 'B']), { is_anonymous: true }),
    /verified_account_required/,
  );
});

test('full trip: only one driver wins, statuses advance, audit trail is complete', async () => {
  const patient = await createUser();
  const stranger = await createUser();
  const driverA = await approvedDriver(admin, 'Driver A');
  const driverB = await approvedDriver(admin, 'Driver B');
  const booking = await request(patient);

  // Both drivers see it in the queue; the stranger does not.
  for (const d of [driverA, driverB]) {
    assert.equal((await as(d, (q) => q.rows(`select id from public.bookings`))).length, 1);
  }
  assert.equal((await as(stranger, (q) => q.rows(`select id from public.bookings`))).length, 0);

  // Before assignment the patient cannot see any driver.
  assert.equal((await as(patient, (q) => q.rows(`select id from public.drivers`))).length, 0);

  const accepted = await as(driverA, (q) => q.rpc('accept_booking', [booking.id]));
  assert.equal(accepted.status, 'assigned');
  assert.equal(accepted.driver_id, driverA);
  await fails(as(driverB, (q) => q.rpc('accept_booking', [booking.id])), /booking_already_taken/);
  assert.equal((await as(driverB, (q) => q.rows(`select id from public.bookings`))).length, 0);

  // During the trip the patient sees their driver, and only their driver.
  await as(driverA, (q) => q.rpc('driver_heartbeat', [4.97, 8.34, null, null, null]));
  await as(driverB, (q) => q.rpc('driver_heartbeat', [4.98, 8.35, null, null, null]));
  await as(patient, async (q) => {
    assert.deepEqual((await q.rows(`select id from public.drivers`)).map((r) => r.id), [driverA]);
    assert.deepEqual((await q.rows(`select driver_id from public.driver_locations`)).map((r) => r.driver_id), [driverA]);
    const names = (await q.rows(`select full_name from public.profiles order by full_name`)).map((r) => r.full_name);
    assert.deepEqual(names, ['Driver A', 'patient']);
  });

  // A busy driver cannot go offline or take another request.
  await fails(as(driverA, (q) => q.rpc('set_availability', [false])), /on_active_trip/);

  // The patient may cancel only until arrival.
  let b = await as(driverA, (q) => q.rpc('advance_booking', [booking.id]));
  assert.equal(b.status, 'arrived_at_patient');
  await fails(as(patient, (q) => q.rpc('cancel_booking', [booking.id, null])), /invalid_transition/);
  await fails(as(driverB, (q) => q.rpc('advance_booking', [booking.id])), /not_allowed/);

  b = await as(driverA, (q) => q.rpc('advance_booking', [booking.id]));
  assert.equal(b.status, 'en_route_to_hospital');
  b = await as(driverA, (q) => q.rpc('advance_booking', [booking.id]));
  assert.equal(b.status, 'completed');
  assert.ok(b.arrived_at && b.departed_at && b.completed_at);
  await fails(as(driverA, (q) => q.rpc('advance_booking', [booking.id])), /invalid_transition/);

  const driver = await as(driverA, (q) => q.one(`select availability from public.drivers`));
  assert.equal(driver.availability, 'available');

  const events = await as(patient, (q) =>
    q.rows(`select to_status from public.booking_events where booking_id = $1 order by id`, [booking.id]),
  );
  assert.deepEqual(events.map((e) => e.to_status),
    ['pending', 'assigned', 'arrived_at_patient', 'en_route_to_hospital', 'completed']);

  // After the trip the patient no longer sees the driver.
  assert.equal((await as(patient, (q) => q.rows(`select id from public.drivers`))).length, 0);
});

test('release returns the request to the queue and hides it from that driver', async () => {
  const patient = await createUser();
  const driver = await approvedDriver(admin, 'Releasing Driver');
  const other = await approvedDriver(admin, 'Other Driver');
  const booking = await request(patient);

  await as(driver, (q) => q.rpc('accept_booking', [booking.id]));
  const released = await as(driver, (q) => q.rpc('release_booking', [booking.id, 'flat tyre']));
  assert.equal(released.status, 'pending');
  assert.equal(released.driver_id, null);

  assert.equal((await as(driver, (q) => q.rows(`select id from public.bookings`))).length, 0);
  assert.equal((await as(other, (q) => q.rows(`select id from public.bookings`))).length, 1);
  assert.equal((await as(driver, (q) => q.one(`select availability from public.drivers`))).availability, 'available');

  // The patient cancels; nobody is left busy.
  const cancelled = await as(patient, (q) => q.rpc('cancel_booking', [booking.id, 'no longer needed']));
  assert.equal(cancelled.status, 'cancelled');
});

test('dispatcher can assign, reassign and cancel; others cannot', async () => {
  const patient = await createUser();
  const driverA = await approvedDriver(admin, 'Assign A');
  const driverB = await approvedDriver(admin, 'Assign B');
  const booking = await request(patient);

  await fails(as(patient, (q) => q.rpc('assign_booking', [booking.id, driverA])), /not_allowed/);
  await fails(as(driverA, (q) => q.rpc('nearest_drivers', [booking.id, 5])), /not_allowed/);

  await as(driverA, (q) => q.rpc('driver_heartbeat', [4.9760, 8.3420, null, null, null]));
  await as(driverB, (q) => q.rpc('driver_heartbeat', [5.0300, 8.3500, null, null, null]));
  const nearest = await as(admin, (q) =>
    q.rows(`select driver_id from public.nearest_drivers($1, 2)`, [booking.id]),
  );
  assert.equal(nearest[0].driver_id, driverA);

  let b = await as(admin, (q) => q.rpc('assign_booking', [booking.id, driverA]));
  assert.equal(b.driver_id, driverA);
  b = await as(admin, (q) => q.rpc('assign_booking', [booking.id, driverB]));
  assert.equal(b.driver_id, driverB);

  const states = await as(admin, (q) =>
    q.rows(`select id, availability from public.drivers where id in ($1, $2)`, [driverA, driverB]),
  );
  assert.equal(states.find((d) => d.id === driverA).availability, 'available');
  assert.equal(states.find((d) => d.id === driverB).availability, 'busy');

  // A busy driver cannot be given a second trip.
  const patient2 = await createUser();
  const booking2 = await request(patient2);
  await fails(as(admin, (q) => q.rpc('assign_booking', [booking2.id, driverB])), /driver_not_available/);

  await as(driverB, (q) => q.rpc('advance_booking', [booking.id]));
  b = await as(admin, (q) => q.rpc('cancel_booking', [booking.id, 'duplicate call']));
  assert.equal(b.status, 'cancelled');
  assert.equal((await as(driverB, (q) => q.one(`select availability from public.drivers`))).availability, 'available');
  await as(admin, (q) => q.rpc('cancel_booking', [booking2.id, null]));
});

test('stale drivers go offline; offline drivers cannot send positions', async () => {
  const driver = await approvedDriver(admin, 'Stale Driver');
  await db.query(`update public.drivers set last_seen_at = now() - interval '5 minutes' where id = $1`, [driver]);
  await db.query(`select public.mark_stale_drivers()`);
  assert.equal((await as(driver, (q) => q.one(`select availability from public.drivers`))).availability, 'offline');
  await fails(as(driver, (q) => q.rpc('driver_heartbeat', [4.9, 8.3, null, null, null])), /driver_offline/);
  await fails(as(driver, (q) => q.rpc('mark_stale_drivers')), /permission denied/);
});

test('chat: one technician claims; only participants read and post', async () => {
  const patient = await createUser();
  const outsider = await createUser();
  const techA = await createUser('technician', 'Tech A');
  const techB = await createUser('technician', 'Tech B');

  const convo = await as(patient, (q) =>
    q.one(`insert into public.conversations (patient_id) values ($1) returning id`, [patient]),
  );
  await fails(
    as(outsider, (q) => q.rows(`insert into public.conversations (patient_id) values ($1)`, [patient])),
    /row-level security/,
  );

  assert.equal((await as(techA, (q) => q.rows(`select id from public.conversations`))).length, 1);
  assert.equal((await as(outsider, (q) => q.rows(`select id from public.conversations`))).length, 0);

  await fails(as(outsider, (q) => q.rpc('claim_conversation', [convo.id])), /not_allowed/);
  await as(techA, (q) => q.rpc('claim_conversation', [convo.id]));
  await fails(as(techB, (q) => q.rpc('claim_conversation', [convo.id])), /conversation_already_claimed/);
  assert.equal((await as(techB, (q) => q.rows(`select id from public.conversations`))).length, 0);

  const post = (user, sender = user) =>
    as(user, (q) =>
      q.rows(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'hello')`,
        [convo.id, sender]),
    );
  await post(patient);
  await post(techA);
  await fails(post(outsider), /row-level security/);
  await fails(post(techB), /row-level security/);
  await fails(post(patient, techA), /row-level security/); // cannot post as someone else

  assert.equal((await as(patient, (q) => q.rows(`select id from public.messages`))).length, 2);
  assert.equal((await as(outsider, (q) => q.rows(`select id from public.messages`))).length, 0);

  await as(patient, (q) => q.rpc('close_conversation', [convo.id]));
  await fails(post(patient), /row-level security/);
});

test('reviews: the public sees approved ones only; admins moderate', async () => {
  const author = await createUser();
  const review = await as(author, (q) =>
    q.one(
      `insert into public.reviews (author_id, display_name, rating, comment)
       values ($1, 'Ada', 5, 'Fast response') returning id, status`,
      [author],
    ),
  );
  assert.equal(review.status, 'pending');
  await fails(
    as(author, (q) =>
      q.rows(`insert into public.reviews (author_id, display_name, rating, comment, status)
              values ($1, 'Ada', 5, 'x', 'approved')`, [author]),
    ),
    /permission denied/,
  );
  assert.equal((await as(null, (q) => q.rows(`select id from public.reviews`))).length, 0);
  assert.equal((await as(author, (q) => q.rows(`update public.reviews set status = 'approved' returning id`))).length, 0);

  await as(admin, (q) => q.rows(`update public.reviews set status = 'approved' where id = $1`, [review.id]));
  assert.equal((await as(null, (q) => q.rows(`select id from public.reviews`))).length, 1);
});

test('hospitals: only admins change them; archived ones are hidden', async () => {
  const user = await createUser();
  await fails(
    as(user, (q) => q.rows(`insert into public.hospitals (name, lat, lng) values ('Fake', 5, 8)`)),
    /row-level security/,
  );
  assert.equal((await as(user, (q) => q.rows(`update public.hospitals set name = 'Hacked' returning id`))).length, 0);

  const added = await as(admin, (q) =>
    q.one(`insert into public.hospitals (name, lat, lng) values ('New Clinic', 5, 8.3) returning id`),
  );
  await as(admin, (q) => q.rows(`update public.hospitals set is_archived = true where id = $1`, [added.id]));
  assert.equal((await as(null, (q) => q.rows(`select id from public.hospitals`))).length, 5);
  assert.equal((await as(admin, (q) => q.rows(`select id from public.hospitals`))).length, 6);
});

test('patient records: crew write, admins read all, patients neither', async () => {
  const patient = await createUser();
  const driver = await approvedDriver(admin, 'Record Driver');
  const insert = (user) =>
    as(user, (q) =>
      q.rows(
        `insert into public.patient_records (client_request_id, recorded_by, full_name, age)
         values ($1, $2, 'John Doe', 40)`,
        [randomUUID(), user],
      ),
    );
  await fails(insert(patient), /row-level security/);
  await insert(driver);
  assert.equal((await as(driver, (q) => q.rows(`select id from public.patient_records`))).length, 1);
  assert.equal((await as(patient, (q) => q.rows(`select id from public.patient_records`))).length, 0);
  assert.ok((await as(admin, (q) => q.rows(`select id from public.patient_records`))).length >= 1);
});

test('push: a device address follows whoever is signed in on it', async () => {
  const first = await createUser();
  const second = await createUser();
  const save = (user, endpoint = 'https://fcm.googleapis.com/fcm/send/abc') =>
    as(user, (q) => q.rpc('save_push_subscription', [endpoint, 'p'.repeat(87), 'a'.repeat(22), 'test']));

  await fails(save(null), /permission denied/);
  await fails(save(first, 'http://example.org/x'), /invalid_input/);

  await save(first);
  await save(first); // saving again is not an error
  assert.equal((await as(first, (q) => q.rows(`select id from public.push_subscriptions`))).length, 1);

  await save(second);
  assert.equal((await as(first, (q) => q.rows(`select id from public.push_subscriptions`))).length, 0);
  assert.equal((await as(second, (q) => q.rows(`select id from public.push_subscriptions`))).length, 1);

  await as(second, (q) => q.rows(`delete from public.push_subscriptions`));
  assert.equal((await db.query(`select id from public.push_subscriptions`)).rows.length, 0);
});

test('push: each booking event asks for a push once the address is set, and never blocks', async () => {
  // Stand-in for pg_net, which PGlite does not have.
  await db.exec(`
    create schema net;
    create table net.calls (url text, body jsonb);
    create function net.http_post(url text, body jsonb, headers jsonb) returns bigint
    language plpgsql as $$
    begin
      if url like '%/broken' then raise exception 'network down'; end if;
      insert into net.calls values (url, body);
      return 1;
    end $$;
  `);
  const calls = async () => (await db.query(`select url, body from net.calls`)).rows;

  // No address configured: nothing is attempted.
  await request(await createUser());
  assert.equal((await calls()).length, 0);

  await db.exec(`insert into private.push_config (function_url) values ('https://x.test/push-notify')`);
  const booking = await request(await createUser());
  const queued = await calls();
  assert.equal(queued.length, 1);
  const event = (
    await db.query(`select id, notified_at from public.booking_events where booking_id = $1`, [booking.id])
  ).rows[0];
  assert.equal(Number(queued[0].body.event_id), Number(event.id));
  assert.equal(event.notified_at, null);

  // A failing request must not undo the booking.
  await db.exec(`update private.push_config set function_url = 'https://x.test/broken'`);
  const kept = await request(await createUser());
  assert.equal(kept.status, 'pending');
  assert.equal((await calls()).length, 1);

  // Clients cannot see or change where pushes are sent.
  const user = await createUser();
  await fails(as(user, (q) => q.rows(`select * from private.push_config`)), /permission denied/);
  await db.exec(`delete from private.push_config`);
});

// ------------------------------------------------------------------ run

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${String(err.message).split('\n').join('\n        ')}`);
  }
}
console.log(`\n${tests.length - failed} passed, ${failed} failed`);
await db.close();
process.exit(failed ? 1 : 0);
