#!/usr/bin/env node
/**
 * Runs the pgTAP suites in supabase/tests/database against the linked hosted
 * project via the Management API. Each suite rolls itself back completely, so
 * nothing is left behind. Prints failures and a summary; exits 1 on failure.
 *
 * Usage: node scripts/db-test-remote.mjs [--verbose]
 */
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testsDir = path.join(root, 'supabase', 'tests', 'database')
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js')
const verbose = process.argv.includes('--verbose')

let failedSuites = 0

for (const file of readdirSync(testsDir).filter((f) => f.endsWith('.test.sql')).sort()) {
  let stdout
  try {
    stdout = execFileSync(process.execPath, [cli, 'db', 'query', '--linked', '-f', path.join(testsDir, file)], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    console.error(`✖ ${file}: could not run\n${error.stderr || error.message}`)
    failedSuites++
    continue
  }

  const rows = JSON.parse(stdout.slice(stdout.indexOf('{'))).rows ?? []
  const lines = rows.map((row) => String(Object.values(row)[0]))
  const plan = Number(/^1\.\.(\d+)/.exec(lines.find((l) => /^1\.\.\d+/.test(l)) ?? '')?.[1] ?? NaN)
  const passed = lines.filter((l) => l.startsWith('ok ')).length
  const failed = lines.filter((l) => l.startsWith('not ok'))

  if (verbose) console.log(lines.join('\n'))
  for (const [index, line] of lines.entries()) {
    if (!line.startsWith('not ok')) continue
    console.log(`  ${line}`)
    // pgTAP puts diagnostics on the following "#" lines
    for (const next of lines.slice(index + 1)) {
      if (!next.startsWith('#')) break
      console.log(`    ${next}`)
    }
  }

  const complete = passed + failed.length === plan
  const ok = failed.length === 0 && complete
  if (!ok) failedSuites++
  console.log(
    `${ok ? '✔' : '✖'} ${file}: ${passed}/${plan} passed` +
      (failed.length ? `, ${failed.length} failed` : '') +
      (complete ? '' : ` (expected ${plan}, ran ${passed + failed.length})`),
  )
}

process.exitCode = failedSuites ? 1 : 0
