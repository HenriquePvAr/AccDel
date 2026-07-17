import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { chmod, stat } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const configPath = join(root, '.env.staging')
const runtimePath = join(root, '.pilot', 'runtime.env')
const composePath = join(root, 'docker-compose.staging.yml')
const backupDir = join(root, 'backups')
const command = process.argv[2]

if (!['backup', 'restore', 'test'].includes(command ?? '')) {
  console.error('Use: node scripts/pilot-database.mjs <backup|restore|test> [arquivo] [banco_destino]')
  process.exit(2)
}
if (!existsSync(configPath) || !existsSync(runtimePath)) {
  throw new Error('Execute npm run staging:up antes de usar backup ou restore.')
}

const config = {
  ...parseEnvironment(readFileSync(configPath, 'utf8')),
  ...parseEnvironment(readFileSync(runtimePath, 'utf8')),
}
assertSafeDatabaseName(config.POSTGRES_DB)
mkdirSync(backupDir, { recursive: true })

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

if (command === 'backup') {
  const output = join(backupDir, `cain-pilot-${timestamp}.dump`)
  await createBackup(output)
  console.log(`Backup verificado: ${output}`)
}

if (command === 'restore') {
  const input = resolve(process.argv[3] ?? '')
  const target = process.argv[4] ?? ''
  if (!existsSync(input)) throw new Error('Informe um arquivo de backup existente.')
  assertSafeRestoreName(target)
  await restoreBackup(input, target)
  console.log(`Restore concluido no banco temporario ${target}. Nenhum banco existente foi removido.`)
}

if (command === 'test') {
  const output = join(backupDir, `cain-pilot-restore-test-${timestamp}.dump`)
  const target = `cain_pilot_restore_test_${Date.now()}`
  await createBackup(output)
  try {
    await restoreBackup(output, target)
    const applied = runComposeCapture([
      'exec', '-T', 'postgres', 'psql', '-U', config.POSTGRES_USER,
      '-d', target, '-Atc', 'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;',
    ]).trim()
    if (applied !== '23') throw new Error(`Restore retornou ${applied} migracoes, esperado 23.`)
    console.log(`Restore temporario validado com ${applied} migracoes aplicadas.`)
  } finally {
    runCompose(['exec', '-T', 'postgres', 'dropdb', '-U', config.POSTGRES_USER, '--if-exists', target])
  }
}

async function createBackup(output) {
  const child = spawnCompose([
    'exec', '-T', 'postgres', 'pg_dump', '-U', config.POSTGRES_USER,
    '--format=custom', '--no-owner', '--no-privileges', config.POSTGRES_DB,
  ], ['ignore', 'pipe', 'inherit'])
  const outputStream = createWriteStream(output, { mode: 0o600 })
  const outputFinished = new Promise((resolvePromise, reject) => {
    outputStream.once('finish', resolvePromise)
    outputStream.once('error', reject)
  })
  child.stdout.pipe(outputStream)
  await Promise.all([waitFor(child, 'pg_dump'), outputFinished])
  await chmod(output, 0o600).catch(() => undefined)
  const info = await stat(output)
  if (info.size < 1_024) throw new Error('Backup gerado e pequeno demais para ser valido.')
  await verifyArchive(output)
}

async function verifyArchive(input) {
  const child = spawnCompose(
    ['exec', '-T', 'postgres', 'pg_restore', '--list'],
    ['pipe', 'ignore', 'inherit'],
  )
  createReadStream(input).pipe(child.stdin)
  await waitFor(child, 'pg_restore --list')
}

async function restoreBackup(input, target) {
  assertSafeRestoreName(target)
  const existing = runComposeCapture([
    'exec', '-T', 'postgres', 'psql', '-U', config.POSTGRES_USER,
    '-d', 'postgres', '-Atc', `SELECT 1 FROM pg_database WHERE datname = '${target}';`,
  ]).trim()
  if (existing) throw new Error(`O banco destino ${target} ja existe; restore nao sobrescreve bancos.`)
  runCompose(['exec', '-T', 'postgres', 'createdb', '-U', config.POSTGRES_USER, target])
  const child = spawnCompose([
    'exec', '-T', 'postgres', 'pg_restore', '-U', config.POSTGRES_USER,
    '--exit-on-error', '--no-owner', '--no-privileges', '--dbname', target,
  ], ['pipe', 'ignore', 'inherit'])
  createReadStream(input).pipe(child.stdin)
  await waitFor(child, `pg_restore ${basename(input)}`)
}

function assertSafeDatabaseName(name) {
  if (!/^(?=.*(?:pilot|staging|test|demo))[a-z0-9_]+$/i.test(name ?? '')) {
    throw new Error('Banco de origem fora do escopo seguro de piloto.')
  }
}

function assertSafeRestoreName(name) {
  if (!/^cain_(?:pilot|staging|test|demo)_[a-z0-9_]+$/i.test(name ?? '')) {
    throw new Error('Destino deve ser um novo banco temporario cain_pilot_*, cain_staging_*, cain_test_* ou cain_demo_* .')
  }
}

function composeBase() {
  return ['compose', '--env-file', configPath, '--env-file', runtimePath, '-f', composePath]
}

function spawnCompose(args, stdio) {
  return spawn('docker', [...composeBase(), ...args], { cwd: root, shell: false, stdio })
}

function runCompose(args) {
  const result = spawnSync('docker', [...composeBase(), ...args], { cwd: root, shell: false, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Docker Compose falhou com status ${result.status ?? 'desconhecido'}.`)
}

function runComposeCapture(args) {
  const result = spawnSync('docker', [...composeBase(), ...args], { cwd: root, shell: false, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Docker Compose falhou.')
  return result.stdout
}

function waitFor(child, label) {
  return new Promise((resolvePromise, reject) => {
    child.once('error', reject)
    child.once('close', (code) => code === 0
      ? resolvePromise()
      : reject(new Error(`${label} falhou com status ${code ?? 'desconhecido'}.`)))
  })
}

function parseEnvironment(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return []
    const separator = trimmed.indexOf('=')
    return separator > 0 ? [[trimmed.slice(0, separator), trimmed.slice(separator + 1)]] : []
  }))
}
