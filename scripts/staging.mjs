import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const configPath = join(root, '.env.staging')
const examplePath = join(root, '.env.staging.example')
const pilotDir = join(root, '.pilot')
const runtimePath = join(pilotDir, 'runtime.env')
const composePath = join(root, 'docker-compose.staging.yml')
const command = process.argv[2]
const allowedCommands = new Set(['up', 'seed', 'status', 'logs', 'down'])

if (!allowedCommands.has(command)) {
  console.error('Use: node scripts/staging.mjs <up|seed|status|logs|down>')
  process.exit(2)
}

if (!existsSync(configPath)) {
  if (!['up', 'seed'].includes(command)) {
    console.error('.env.staging ainda nao existe. Execute npm run staging:up primeiro.')
    process.exit(2)
  }
  copyFileSync(examplePath, configPath)
  console.log('Criado .env.staging a partir do exemplo rastreado.')
}

const config = parseEnvironment(readFileSync(configPath, 'utf8'))
assertSafeStaging(config)

if (['up', 'seed'].includes(command)) ensureRuntime(config)

const composeArgs = ['compose', '--env-file', configPath]
if (existsSync(runtimePath)) composeArgs.push('--env-file', runtimePath)
composeArgs.push('-f', composePath)

const commandArgs = {
  up: ['up', '-d', '--build', '--remove-orphans'],
  seed: ['run', '--rm', 'api', 'npm', 'run', 'seed:pilot'],
  status: ['ps'],
  logs: ['logs', '--tail', '200'],
  down: ['down', '--remove-orphans'],
}[command]

const sourceCommit = readSourceCommit()
const result = spawnSync('docker', [...composeArgs, ...commandArgs], {
  cwd: root,
  env: { ...process.env, SOURCE_COMMIT: sourceCommit },
  shell: false,
  stdio: 'inherit',
})

if (result.error) {
  console.error(`Docker Compose indisponivel: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0) process.exit(result.status ?? 1)

if (command === 'down') {
  console.log('Stack encerrada. O volume PostgreSQL foi preservado; este comando nunca usa -v.')
}
if (command === 'seed') {
  console.log(`Seed concluido. Credenciais locais: ${join(pilotDir, 'seed-credentials.txt')}`)
}

function ensureRuntime(environment) {
  if (existsSync(runtimePath)) return
  mkdirSync(pilotDir, { recursive: true })
  const password = randomBytes(24).toString('base64url')
  const encodedPassword = encodeURIComponent(password)
  const databaseName = environment.POSTGRES_DB
  const databaseUser = environment.POSTGRES_USER
  const databaseUrl = `postgresql://${databaseUser}:${encodedPassword}@postgres:5432/${databaseName}?schema=public`
  const values = {
    POSTGRES_PASSWORD: password,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
    CAIN_PRINT_AGENT_TOKEN: `cpa_${randomBytes(6).toString('hex')}_${randomBytes(32).toString('base64url')}`,
    PILOT_USER_PASSWORD: `Pilot-${randomBytes(18).toString('base64url')}`,
  }
  writeFileSync(
    runtimePath,
    `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`,
    { encoding: 'utf8', mode: 0o600 },
  )
  try { chmodSync(runtimePath, 0o600) } catch { /* Windows ACLs remain authoritative. */ }
  console.log(`Credenciais de runtime geradas em ${runtimePath}.`)
}

function assertSafeStaging(environment) {
  if (environment.APP_ENV !== 'staging') throw new Error('APP_ENV deve ser staging.')
  if (environment.NODE_ENV !== 'production') throw new Error('NODE_ENV deve ser production no build de staging.')
  if (!/pilot|staging|test|demo/i.test(environment.POSTGRES_DB ?? '')) {
    throw new Error('POSTGRES_DB precisa conter pilot, staging, test ou demo.')
  }
  if (environment.WHATSAPP_PROVIDER !== 'disabled' || environment.AI_PROVIDER !== 'disabled') {
    throw new Error('Providers externos devem permanecer disabled no staging local.')
  }
}

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return []
    const separator = trimmed.indexOf('=')
    return separator > 0 ? [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]] : []
  }))
}

function readSourceCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'pilot-local'
  }
}
