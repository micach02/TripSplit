#!/usr/bin/env node
/**
 * Runs Vite or Vitest from a working directory with an upper-case drive letter.
 *
 * On Windows, a terminal opened as "d:\…" (VS Code often does this) makes Node
 * see two spellings of the same files. Vitest then loads its runner twice and
 * every suite fails with "Cannot read properties of undefined (reading 'config')";
 * a production build bundles React twice and the app crashes on start with
 * "Cannot read properties of null (reading 'useState')". Elsewhere this just
 * runs the tool.
 *
 * Usage: node scripts/upper-drive.mjs <vite|vitest> [args…]
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ENTRY = { vite: ['vite', 'bin', 'vite.js'], vitest: ['vitest', 'vitest.mjs'] }

const [tool, ...args] = process.argv.slice(2)
if (!(tool in ENTRY)) {
  console.error(`Usage: node scripts/upper-drive.mjs <${Object.keys(ENTRY).join('|')}> [args…]`)
  process.exit(1)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cwd = root.replace(/^[a-z]:/, (drive) => drive.toUpperCase())
const entry = path.join(cwd, 'node_modules', ...ENTRY[tool])

const result = spawnSync(process.execPath, [entry, ...args], { cwd, stdio: 'inherit' })
process.exit(result.status ?? 1)
