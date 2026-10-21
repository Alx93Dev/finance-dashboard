// Runs `ng test`, dropping the bare `--` separator that pnpm forwards
// (e.g. `pnpm test -- --watch=false`), which the Angular CLI rejects.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ng = require.resolve('@angular/cli/bin/ng.js');
const args = process.argv.slice(2).filter(arg => arg !== '--');

const { status } = spawnSync(process.execPath, [ng, 'test', ...args], { stdio: 'inherit' });
process.exit(status ?? 1);
