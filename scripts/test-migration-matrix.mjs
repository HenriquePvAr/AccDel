import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const apiDir = join(root, 'apps', 'api')
const sourcePrisma = join(apiDir, 'prisma')
const sourceMigrations = join(sourcePrisma, 'migrations')
const configPath = join(root, '.env.staging')
const runtimePath = join(root, '.pilot', 'runtime.env')
const composePath = join(root, 'docker-compose.staging.yml')

const dockerAvailable = spawnSync('docker', ['version'], { shell: false, stdio: 'ignore' }).status === 0
const config = existsSync(configPath) && existsSync(runtimePath)
  ? {
      ...parseEnvironment(readFileSync(configPath, 'utf8')),
      ...parseEnvironment(readFileSync(runtimePath, 'utf8')),
    }
  : {}
const localDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL
if (!dockerAvailable && !localDatabaseUrl) {
  throw new Error('Use a stack de staging ou defina MIGRATION_TEST_DATABASE_URL para PostgreSQL local.')
}
if (dockerAvailable && !/pilot|staging|test|demo/i.test(config.POSTGRES_DB ?? '')) {
  throw new Error('A matriz aceita somente a stack local de piloto.')
}
if (localDatabaseUrl) assertSafeLocalUrl(localDatabaseUrl)
const require = createRequire(join(apiDir, 'package.json'))
const { Client } = require('pg')

const migrationNames = readdirSync(sourceMigrations, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
if (migrationNames.length !== 23) {
  throw new Error(`A matriz esperava 23 migracoes, encontrou ${migrationNames.length}.`)
}

const runId = Date.now()
const matrixRoot = join(root, '.pilot', 'migration-matrix', String(runId))
const results = []

for (const baseCount of [0, 19, 21, 22]) {
  const databaseName = `cain_pilot_migration_${baseCount}_${runId}`
  await createDatabase(databaseName)
  try {
    const databaseUrl = hostDatabaseUrl(databaseName)
    if (baseCount > 0) {
      const partialPrisma = join(matrixRoot, `base-${baseCount}`, 'prisma')
      const partialMigrations = join(partialPrisma, 'migrations')
      mkdirSync(partialMigrations, { recursive: true })
      cpSync(join(sourcePrisma, 'schema.prisma'), join(partialPrisma, 'schema.prisma'))
      cpSync(join(sourceMigrations, 'migration_lock.toml'), join(partialMigrations, 'migration_lock.toml'))
      for (const migration of migrationNames.slice(0, baseCount)) {
        cpSync(join(sourceMigrations, migration), join(partialMigrations, migration), { recursive: true })
      }
      migrate(databaseUrl, join(partialPrisma, 'schema.prisma'))
    }

    migrate(databaseUrl, join(sourcePrisma, 'schema.prisma'))
    const counts = (await query(databaseName, `
      SELECT
        COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
        COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed
      FROM "_prisma_migrations";
    `)).trim()
    if (counts !== '23|0') {
      throw new Error(`Cenario ${baseCount}->23 retornou ${counts}, esperado 23|0.`)
    }
    results.push({ from: baseCount, to: 23, applied: 23, failed: 0 })
  } finally {
    await dropDatabase(databaseName)
  }
}

console.log(JSON.stringify({ event: 'migration_matrix_passed', scenarios: results }))

function migrate(databaseUrl, schemaPath) {
  const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js')
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    shell: false,
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error(`prisma migrate deploy falhou para ${schemaPath}.`)
}

async function createDatabase(name) {
  if (dockerAvailable) {
    runCompose(['exec', '-T', 'postgres', 'createdb', '-U', config.POSTGRES_USER, name])
    return
  }
  await localAdminQuery(`CREATE DATABASE "${name}";`)
}

async function dropDatabase(name) {
  if (!/^cain_pilot_migration_\d+_\d+$/.test(name)) throw new Error('Recusa de drop fora do banco temporario da matriz.')
  if (dockerAvailable) {
    runCompose(['exec', '-T', 'postgres', 'dropdb', '-U', config.POSTGRES_USER, '--if-exists', name])
    return
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  await localAdminQuery(`DROP DATABASE IF EXISTS "${name}";`)
}

async function query(databaseName, sql) {
  if (dockerAvailable) {
    const result = runCompose([
      'exec', '-T', 'postgres', 'psql', '-U', config.POSTGRES_USER,
      '-d', databaseName, '-At', '-F', '|', '-c', sql,
    ], true)
    return result.stdout.trim()
  }
  const client = new Client({ connectionString: hostDatabaseUrl(databaseName) })
  await client.connect()
  try {
    const result = await client.query(sql)
    const row = result.rows[0]
    return `${row.applied}|${row.failed}`
  } finally {
    await client.end()
  }
}

function hostDatabaseUrl(databaseName) {
  if (!dockerAvailable) {
    const url = new URL(localDatabaseUrl)
    url.pathname = `/${databaseName}`
    url.searchParams.set('schema', 'public')
    return url.toString()
  }
  return `postgresql://${encodeURIComponent(config.POSTGRES_USER)}:${encodeURIComponent(config.POSTGRES_PASSWORD)}@127.0.0.1:${config.STAGING_POSTGRES_PORT}/${databaseName}?schema=public`
}

async function localAdminQuery(sql) {
  const url = new URL(localDatabaseUrl)
  url.pathname = '/postgres'
  url.search = ''
  const client = new Client({ connectionString: url.toString() })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

function assertSafeLocalUrl(value) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('MIGRATION_TEST_DATABASE_URL deve apontar para localhost.')
  }
  if (!/pilot|staging|test|demo/i.test(url.pathname)) {
    throw new Error('MIGRATION_TEST_DATABASE_URL deve usar banco piloto/teste.')
  }
}

function runCompose(args, capture = false) {
  const result = spawnSync('docker', [
    'compose', '--env-file', configPath, '--env-file', runtimePath,
    '-f', composePath, ...args,
  ], {
    cwd: root,
    shell: false,
    ...(capture ? { encoding: 'utf8' } : { stdio: 'inherit' }),
  })
  if (result.status !== 0) throw new Error(`Docker Compose falhou com status ${result.status ?? 'desconhecido'}.`)
  return result
}

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return []
    const separator = trimmed.indexOf('=')
    return separator > 0 ? [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]] : []
  }))
}
