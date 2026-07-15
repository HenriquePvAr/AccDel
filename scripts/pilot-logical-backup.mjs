import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chmod } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const apiDir = join(root, 'apps', 'api')
const backupDir = join(root, 'backups')
const sourceUrl = resolveSourceUrl()
const sourceDatabase = new URL(sourceUrl).pathname.replace(/^\//, '')
const command = process.argv[2]
const require = createRequire(join(apiDir, 'package.json'))
const { Client } = require('pg')

if (!['backup', 'restore', 'test'].includes(command ?? '')) {
  console.error('Use: node scripts/pilot-logical-backup.mjs <backup|restore|test> [arquivo] [banco_destino]')
  process.exit(2)
}
assertSafeDatabaseName(sourceDatabase)
assertLocalHost(sourceUrl)
mkdirSync(backupDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

if (command === 'backup') {
  const output = join(backupDir, `cain-pilot-logical-${timestamp}.json`)
  const result = await createBackup(output)
  console.log(JSON.stringify({ event: 'pilot_backup_created', file: output, ...result }))
}

if (command === 'restore') {
  const input = resolve(process.argv[3] ?? '')
  const target = process.argv[4] ?? ''
  if (!existsSync(input)) throw new Error('Informe um arquivo de backup existente.')
  assertSafeRestoreName(target)
  const result = await restoreBackup(input, target)
  console.log(JSON.stringify({ event: 'pilot_restore_completed', target, ...result }))
}

if (command === 'test') {
  const output = join(backupDir, `cain-pilot-logical-test-${timestamp}.json`)
  const target = `cain_pilot_restore_test_${Date.now()}`
  const backup = await createBackup(output)
  try {
    const restore = await restoreBackup(output, target)
    if (backup.rows !== restore.rows || backup.tables !== restore.tables) {
      throw new Error('Contagem restaurada diverge do backup.')
    }
    console.log(JSON.stringify({
      event: 'pilot_backup_restore_test_passed',
      file: output,
      target,
      tables: restore.tables,
      rows: restore.rows,
      migrations: restore.migrations,
    }))
  } finally {
    await dropDatabase(target)
  }
}

async function createBackup(output) {
  const client = new Client({ connectionString: sourceUrl })
  await client.connect()
  try {
    const marker = await client.query(
      'SELECT COUNT(*)::int AS count FROM stores WHERE general_notes LIKE $1',
      [`%PILOT_DEMO_DATA%`],
    )
    if (marker.rows[0]?.count !== 1) throw new Error('Banco nao possui a marca PILOT_DEMO_DATA esperada.')
    const migrations = await client.query(
      'SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    )
    if (migrations.rows[0]?.count !== 23) throw new Error('Backup exige exatamente 23 migracoes aplicadas.')
    const tableResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `)
    const tables = []
    let totalRows = 0
    for (const { tablename } of tableResult.rows) {
      assertIdentifier(tablename)
      const columns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tablename])
      const rows = await client.query(`SELECT * FROM public."${tablename}"`)
      totalRows += rows.rowCount ?? 0
      tables.push({
        name: tablename,
        columns: columns.rows.map((column) => column.column_name),
        rows: rows.rows,
      })
    }
    const payload = {
      format: 'cain-pilot-logical-v1',
      marker: 'PILOT_DEMO_DATA',
      createdAt: new Date().toISOString(),
      sourceDatabase,
      migrations: 23,
      tables,
    }
    const serializedPayload = JSON.stringify(payload)
    const envelope = {
      sha256: createHash('sha256').update(serializedPayload).digest('hex'),
      payload,
    }
    writeFileSync(output, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600 })
    await chmod(output, 0o600).catch(() => undefined)
    return { tables: tables.length, rows: totalRows, migrations: 23 }
  } finally {
    await client.end()
  }
}

async function restoreBackup(input, target) {
  assertSafeRestoreName(target)
  const envelope = JSON.parse(readFileSync(input, 'utf8'))
  const serializedPayload = JSON.stringify(envelope.payload)
  const checksum = createHash('sha256').update(serializedPayload).digest('hex')
  if (checksum !== envelope.sha256) throw new Error('Checksum do backup invalido.')
  if (envelope.payload?.format !== 'cain-pilot-logical-v1' || envelope.payload?.marker !== 'PILOT_DEMO_DATA') {
    throw new Error('Formato ou marcador do backup invalido.')
  }
  if (envelope.payload?.migrations !== 23) throw new Error('Backup nao corresponde ao schema de 23 migracoes.')

  await assertDatabaseDoesNotExist(target)
  await adminQuery(`CREATE DATABASE "${target}";`)
  try {
    const targetUrl = databaseUrl(target)
    migrate(targetUrl)
    const client = new Client({ connectionString: targetUrl })
    await client.connect()
    let totalRows = 0
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL session_replication_role = replica')
      for (const table of envelope.payload.tables) {
        assertIdentifier(table.name)
        table.columns.forEach(assertIdentifier)
        const columnSql = table.columns.map((column) => `"${column}"`).join(', ')
        for (const row of table.rows) {
          const values = table.columns.map((column) => row[column])
          const parameters = values.map((_, index) => `$${index + 1}`).join(', ')
          await client.query(
            `INSERT INTO public."${table.name}" (${columnSql}) VALUES (${parameters})`,
            values,
          )
          totalRows += 1
        }
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      await client.end()
    }
    const verification = new Client({ connectionString: targetUrl })
    await verification.connect()
    try {
      const migrations = await verification.query(
        'SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
      )
      const marker = await verification.query(
        'SELECT COUNT(*)::int AS count FROM stores WHERE general_notes LIKE $1',
        ['%PILOT_DEMO_DATA%'],
      )
      if (migrations.rows[0]?.count !== 23 || marker.rows[0]?.count !== 1) {
        throw new Error('Verificacao pos-restore falhou.')
      }
    } finally {
      await verification.end()
    }
    return { tables: envelope.payload.tables.length, rows: totalRows, migrations: 23 }
  } catch (error) {
    await dropDatabase(target)
    throw error
  }
}

function migrate(databaseUrl) {
  const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js')
  const result = spawnSync(process.execPath, [
    prismaCli, 'migrate', 'deploy', '--schema', join(apiDir, 'prisma', 'schema.prisma'),
  ], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    shell: false,
    stdio: 'inherit',
  })
  if (result.status !== 0) throw new Error('Falha ao preparar schema do restore temporario.')
}

async function assertDatabaseDoesNotExist(name) {
  const result = await adminQuery('SELECT 1 FROM pg_database WHERE datname = $1', [name])
  if (result.rowCount) throw new Error(`O banco ${name} ja existe; restore nunca sobrescreve destino.`)
}

async function dropDatabase(name) {
  assertSafeRestoreName(name)
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  await adminQuery(`DROP DATABASE IF EXISTS "${name}";`)
}

async function adminQuery(sql, parameters = []) {
  const url = new URL(sourceUrl)
  url.pathname = '/postgres'
  url.search = ''
  const client = new Client({ connectionString: url.toString() })
  await client.connect()
  try {
    return await client.query(sql, parameters)
  } finally {
    await client.end()
  }
}

function databaseUrl(name) {
  const url = new URL(sourceUrl)
  url.pathname = `/${name}`
  url.searchParams.set('schema', 'public')
  return url.toString()
}

function resolveSourceUrl() {
  const explicit = process.env.PILOT_DATABASE_URL ?? process.env.MIGRATION_TEST_DATABASE_URL
  if (explicit) return explicit
  const configPath = join(root, '.env.staging')
  const runtimePath = join(root, '.pilot', 'runtime.env')
  if (!existsSync(configPath) || !existsSync(runtimePath)) {
    throw new Error('Execute staging:up ou defina PILOT_DATABASE_URL para PostgreSQL local.')
  }
  const config = {
    ...parseEnvironment(readFileSync(configPath, 'utf8')),
    ...parseEnvironment(readFileSync(runtimePath, 'utf8')),
  }
  const url = new URL(config.DATABASE_URL)
  url.hostname = '127.0.0.1'
  url.port = config.STAGING_POSTGRES_PORT
  return url.toString()
}

function assertSafeDatabaseName(name) {
  if (!/^(?=.*(?:pilot|staging|test|demo))[a-z0-9_]+$/i.test(name ?? '')) {
    throw new Error('Banco de origem fora do escopo seguro de piloto.')
  }
}

function assertSafeRestoreName(name) {
  if (!/^cain_(?:pilot|staging|test|demo)_[a-z0-9_]+$/i.test(name ?? '')) {
    throw new Error('Destino deve ser um banco novo e temporario cain_pilot_*, cain_staging_*, cain_test_* ou cain_demo_*.')
  }
}

function assertLocalHost(value) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Backup piloto aceita somente PostgreSQL exposto localmente.')
  }
}

function assertIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Identificador SQL invalido em ${basename(value)}.`)
}

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return []
    const separator = trimmed.indexOf('=')
    return separator > 0 ? [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]] : []
  }))
}
