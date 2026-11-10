// Creates the key pair that signs push notifications and puts each half where
// it belongs:
//   public half  -> .env.local as VITE_VAPID_PUBLIC_KEY (the web app needs it)
//   private half -> a secret of the Supabase project (only push-notify reads it)
//
// The private half is never printed and never written inside the project.
//
// Run once per Supabase project:
//   node scripts/setup-push-keys.mjs <project-ref> <contact>
// where <contact> is "mailto:someone@example.org" or an https address that
// push services (Google, Apple, Mozilla) can use to reach whoever runs the app.
//
// Running it again makes new keys, and every device that had alerts on must
// turn them on again. It refuses to do that unless you add --force.

import { createECDH } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2).filter((arg) => arg !== '--force');
const force = process.argv.includes('--force');
const [projectRef, contact] = args;

if (!/^[a-z0-9]{15,30}$/.test(projectRef ?? '') || !/^(mailto:.+@.+|https:\/\/.+)/.test(contact ?? '')) {
  console.error('Usage: node scripts/setup-push-keys.mjs <project-ref> <mailto:address or https://address> [--force]');
  process.exit(1);
}

const envLocal = path.resolve('.env.local');
const current = existsSync(envLocal) ? readFileSync(envLocal, 'utf8') : '';
const hasKey = /^VITE_VAPID_PUBLIC_KEY=.+$/m.test(current);
if (hasKey && !force) {
  console.error(
    '.env.local already has VITE_VAPID_PUBLIC_KEY. New keys would stop alerts on every device\n' +
      'until each one turns them on again. Add --force if that is what you want.'
  );
  process.exit(1);
}

const pair = createECDH('prime256v1');
pair.generateKeys();
const publicKey = pair.getPublicKey().toString('base64url');
const privateKey = pair.getPrivateKey().toString('base64url');

// The Supabase CLI reads secrets from a file; it lives outside the project and
// is removed straight away.
const dir = mkdtempSync(path.join(os.tmpdir(), 'ems-push-'));
const secretsFile = path.join(dir, 'push.env');
let ok = false;
try {
  writeFileSync(
    secretsFile,
    `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=${contact}\n`,
    { mode: 0o600 }
  );
  const result = spawnSync(
    'npx',
    ['--yes', 'supabase@latest', 'secrets', 'set', '--env-file', `"${secretsFile}"`, '--project-ref', projectRef, '--yes'],
    { stdio: 'inherit', shell: true }
  );
  ok = result.status === 0;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (!ok) {
  console.error('\nThe secrets were not saved, so .env.local was left as it was.');
  process.exit(1);
}

const line = `VITE_VAPID_PUBLIC_KEY=${publicKey}`;
if (hasKey || /^VITE_VAPID_PUBLIC_KEY=/m.test(current)) {
  writeFileSync(envLocal, current.replace(/^VITE_VAPID_PUBLIC_KEY=.*$/m, line));
} else {
  appendFileSync(envLocal, `${current === '' || current.endsWith('\n') ? '' : '\n'}${line}\n`);
}

console.log('\nDone. The public key is in .env.local; restart the dev server or rebuild to pick it up.');
console.log('Set the same VITE_VAPID_PUBLIC_KEY wherever the app is built for hosting.');
