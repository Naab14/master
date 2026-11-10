// Copies Excalidraw's fonts into public/ so the drawing tool loads them from
// this site instead of an outside CDN. Runs before every build and dev start.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const to = join(root, 'public/excalidraw/fonts');
if (existsSync(from)) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}
