/** Roles that sign in at /staff/login with an email and password. */
export const STAFF_ROLES = ['driver', 'technician', 'admin'];

const HOME = {
  admin: '/admin/dispatch',
  driver: '/driver',
  technician: '/technician',
};

/** Where a signed-in user of this role starts. */
export function homeForRole(role) {
  return HOME[role] ?? '/';
}

/**
 * Where to send a staff member after sign-in. A remembered page is only used
 * if it belongs to their own area, so one role is never dropped into another's.
 */
export function landingFor(role, from) {
  const home = homeForRole(role);
  const area = `/${home.split('/')[1]}`;
  if (typeof from === 'string' && (from === area || from.startsWith(`${area}/`))) return from;
  return home;
}
