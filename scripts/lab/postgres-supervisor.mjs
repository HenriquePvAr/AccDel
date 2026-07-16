import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import EmbeddedPostgres from 'embedded-postgres'

const marker = 'CAIN_LAB_RUNTIME_V1'
const runtimeRoot = path.resolve(required('LAB_RUNTIME_ROOT'))
const databaseDir = path.resolve(required('LAB_POSTGRES_DATA_DIR'))
const readyFile = path.resolve(required('LAB_POSTGRES_READY_FILE'))
const stopFile = path.resolve(required('LAB_POSTGRES_STOP_FILE'))
const databaseUrl = new URL(required('DATABASE_URL'))

if (process.env.LAB_RUNTIME_MARKER !== marker) fail('Invalid laboratory runtime marker.')
if (!runtimeRoot.toLowerCase().includes(`${path.sep}.pilot${path.sep}lab`)) {
  fail('Laboratory runtime must remain under .pilot/lab.')
}
for (const ownedPath of [databaseDir, readyFile, stopFile]) {
  if (!ownedPath.toLowerCase().startsWith(`${runtimeRoot.toLowerCase()}${path.sep}`)) {
    fail('PostgreSQL supervisor path escapes the laboratory runtime.')
  }
}
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname)) {
  fail('Laboratory PostgreSQL accepts only loopback.')
}
if (databaseUrl.port !== '55439') fail('Laboratory PostgreSQL port must be 55439.')
const database = databaseUrl.pathname.replace(/^\//, '')
if (!/lab|pilot|test|demo/i.test(database)) fail('Laboratory database name is unsafe.')

await mkdir(runtimeRoot, { recursive: true })
await rm(readyFile, { force: true })
await rm(stopFile, { force: true })

const pg = new EmbeddedPostgres({
  databaseDir,
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  port: 55439,
  persistent: true,
  authMethod: 'password',
  onLog: (message) => process.stdout.write(`[lab-postgres] ${String(message)}\n`),
  onError: (message) => process.stderr.write(`[lab-postgres] ${String(message)}\n`),
})

let started = false
let stopRequested = false
process.on('SIGINT', () => { stopRequested = true })
process.on('SIGTERM', () => { stopRequested = true })

try {
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise()
  await pg.start()
  started = true
  try {
    await pg.createDatabase(database)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.toLowerCase().includes('already exists')) throw error
  }
  await writeFile(
    readyFile,
    `${JSON.stringify({ marker, supervisorPid: process.pid, port: 55439, readyAtUtc: new Date().toISOString() })}\n`,
    { encoding: 'utf8', mode: 0o600 },
  )
  process.stdout.write('[lab-postgres] ready on loopback port 55439.\n')
  while (!stopRequested && !existsSync(stopFile)) await sleep(250)
  process.stdout.write('[lab-postgres] graceful stop requested.\n')
} finally {
  if (started) await pg.stop()
  await rm(readyFile, { force: true })
  await rm(stopFile, { force: true })
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) fail(`${name} is required.`)
  return value
}

function fail(message) {
  throw new Error(message)
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
