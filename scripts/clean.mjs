import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  'packages/shared/dist',
  'apps/server/dist',
  'apps/ai-service/dist',
  'apps/web/dist',
  'node_modules/.cache',
];

for (const t of targets) {
  const p = join(root, t);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log('[clean] removed', t);
  }
}
console.log('[clean] done');
