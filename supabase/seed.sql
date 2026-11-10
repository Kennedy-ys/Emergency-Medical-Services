-- Starting data for local and staging databases.
-- Hospitals carried over from the list that was hard-coded in the old
-- booking page. Replace with an export of the managed list before the pilot.

insert into public.hospitals (name, address, lat, lng) values
  ('University of Calabar Teaching Hospital', 'Calabar', 4.954459674491282, 8.349155108472956),
  ('General Hospital Calabar', 'Mary Slessor Ave, Calabar', 4.956201824517111, 8.336618468145364),
  ('Nigerian Navy Reference Hospital Calabar', 'Murtala Mohammed Hwy, Calabar', 5.003471538582233, 8.333811188370452),
  ('Federal Neuro-Psychiatric Hospital', 'Calabar Rd, Calabar', 4.955880440230755, 8.318562704521664),
  ('Calabar Women and Children Hospital', 'Murtala Mohammed Hwy, Calabar', 5.0354731711099285, 8.347727127321482);

-- First admin: create the user in the Supabase dashboard (Authentication ->
-- Users -> Add user), then run this once with their email:
--
--   update public.profiles set role = 'admin'
--    where id = (select id from auth.users where email = 'admin@example.com');

-- Approving a driver (until the admin screen exists): the driver applies at
-- /driver/register, then run this once with their email:
--
--   update public.drivers set approval_status = 'approved'
--    where id = (select id from auth.users where email = 'driver@example.com');
