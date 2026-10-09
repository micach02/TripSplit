#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the linked hosted project through the
 * Supabase Management API (`supabase db query --linked`) — no Docker and no
 * database password needed, only `supabase login` + `supabase link`.
 *
 * Applied versions are recorded in tripsplit_private.schema_migrations, NOT in
 * the project's CLI history (supabase_migrations.schema_migrations), because
 * the project may be shared with another app that owns that history.
 *
 * Usage:
 *   node scripts/db-migrate-remote.mjs                  apply pending migrations
 *   node scripts/db-migrate-remote.mjs --status         show applied / pending
 *   node scripts/db-migrate-remote.mjs --dry-run        show what would be applied
 *   node scripts/db-migrate-remote.mjs --baseline <v>   record every migration up to version <v>
 *                                                       as applied without running it (for SQL that
 *                                                       was already run by hand)
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'supabase', 'migrations')
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js')

const LOG_TABLE = 'tripsplit_private.schema_migrations'
const ENSURE_LOG_TABLE = `
create schema if not exists tripsplit_private;
create table if not exists ${LOG_TABLE} (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);
revoke all on ${LOG_TABLE} from public, anon, authenticated;
`

const tempDir = mkdtempSync(path.join(tmpdir(), 'tripsplit-migrate-'))

/** Runs SQL against the linked project and returns the rows of the LAST statement. */
function query(sql) {
  const file = path.join(tempDir, 'query.sql')
  writeFileSync(file, sql, 'utf8')
  let stdout
  try {
    stdout = execFileSync(process.execPath, [cli, 'db', 'query', '--linked', '-f', file], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const details = `${error.stdout ?? ''}${error.stderr ?? ''}`
      .split('\n')
      .filter((line) => !/new version of supabase cli|recommend updating|initialising login role/i.test(line))
      .join('\n')
      .trim()
    throw new Error(details || error.message)
  }
  const start = stdout.indexOf('{')
  if (start === -1) return []
  return JSON.parse(stdout.slice(start)).rows ?? []
}

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`

function localMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort()
    .map((file) => {
      const [, version, name] = /^(\d+)_(.+)\.sql$/.exec(file)
      return { version, name, file: path.join(migrationsDir, file) }
    })
}

function appliedVersions() {
  query(ENSURE_LOG_TABLE + `select 1;`)
  return new Set(query(`select version from ${LOG_TABLE} order by version;`).map((row) => row.version))
}

function main() {
  const args = process.argv.slice(2)
  const migrations = localMigrations()
  const applied = appliedVersions()
  const pending = migrations.filter((m) => !applied.has(m.version))

  if (args.includes('--status')) {
    for (const m of migrations) console.log(`${applied.has(m.version) ? '✔ applied' : '• pending'}  ${m.version}_${m.name}`)
    return
  }

  const baselineIndex = args.indexOf('--baseline')
  if (baselineIndex !== -1) {
    const upTo = args[baselineIndex + 1]
    if (!upTo || !migrations.some((m) => m.version === upTo)) {
      throw new Error(`--baseline needs a local migration version, e.g. ${migrations[0]?.version}`)
    }
    const toRecord = pending.filter((m) => m.version <= upTo)
    if (toRecord.length === 0) return console.log('Nothing to baseline.')
    query(
      `insert into ${LOG_TABLE} (version, name) values ` +
        toRecord.map((m) => `(${sqlString(m.version)}, ${sqlString(m.name)})`).join(', ') +
        ' on conflict (version) do nothing; select 1;',
    )
    for (const m of toRecord) console.log(`✔ recorded as applied (not run): ${m.version}_${m.name}`)
    return
  }

  if (pending.length === 0) return console.log('Database is up to date.')

  if (args.includes('--dry-run')) {
    for (const m of pending) console.log(`would apply: ${m.version}_${m.name}`)
    return
  }

  for (const m of pending) {
    process.stdout.write(`applying ${m.version}_${m.name} … `)
    const body = readFileSync(m.file, 'utf8')
    // One transaction per migration: either all of it (and its log row) lands, or nothing does.
    query(
      `begin;\n${body}\n;\ninsert into ${LOG_TABLE} (version, name) values (${sqlString(m.version)}, ${sqlString(m.name)});\ncommit;\nselect 1;`,
    )
    console.log('done')
  }
}

try {
  main()
} catch (error) {
  console.error(`\n✖ ${error.message}`)
  process.exitCode = 1
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
