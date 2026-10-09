#!/usr/bin/env node
/**
 * Starts Vitest from a working directory with an upper-case drive letter.
 *
 * On Windows, a terminal opened as "d:\…" (VS Code often does this) makes
 * Vitest load its runner twice — once per drive-letter casing — and every
 * suite fails with "Cannot read properties of undefined (reading 'config')".
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cwd = root.replace(/^[a-z]:/, (drive) => drive.toUpperCase())
const vitest = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs')

const result = spawnSync(process.execPath, [vitest, ...process.argv.slice(2)], { cwd, stdio: 'inherit' })
process.exit(result.status ?? 1)
