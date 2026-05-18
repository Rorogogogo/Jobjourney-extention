import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..', '..');
const distContentDir = resolve(repoRoot, 'dist', 'content');

test('content build emits the all and jobsites bundles', () => {
  rmSync(distContentDir, { recursive: true, force: true });

  execFileSync('pnpm', ['--filter', '@extension/content-script', 'build'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'pipe',
  });

  assert.equal(existsSync(resolve(distContentDir, 'all.iife.js')), true);
  assert.equal(existsSync(resolve(distContentDir, 'jobsites.iife.js')), true);
});
