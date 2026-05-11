import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

import EmbeddedPostgres from 'embedded-postgres'

function readDatabaseConfig() {
  const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DIRECT_URL or DATABASE_URL must be configured before starting embedded postgres.')
  }

  const parsed = new URL(databaseUrl)
  const database = parsed.pathname.replace(/^\//, '') || 'postgres'
  const port = Number(parsed.port || '5432')

  return {
    host: parsed.hostname,
    port,
    user: decodeURIComponent(parsed.username || 'postgres'),
    password: decodeURIComponent(parsed.password || 'postgres'),
    database,
  }
}

async function main() {
  const config = readDatabaseConfig()

  if (!['localhost', '127.0.0.1'].includes(config.host)) {
    throw new Error(`Embedded postgres only supports localhost in this setup. Received host "${config.host}".`)
  }

  const databaseDir = path.resolve(process.cwd(), '.embedded-postgres', 'data')
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: config.user,
    password: config.password,
    port: config.port,
    persistent: true,
    authMethod: 'password',
    onLog: (message) => {
      process.stdout.write(`[embedded-postgres] ${String(message)}\n`)
    },
    onError: (message) => {
      process.stderr.write(`[embedded-postgres] ${String(message)}\n`)
    },
  })

  const alreadyInitialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'))

  if (!alreadyInitialised) {
    await pg.initialise()
  }
  await pg.start()

  try {
    await pg.createDatabase(config.database)
    process.stdout.write(`[embedded-postgres] database "${config.database}" created.\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.toLowerCase().includes('already exists')) {
      throw error
    }

    process.stdout.write(`[embedded-postgres] database "${config.database}" already exists.\n`)
  }

  process.stdout.write(
    `[embedded-postgres] running on postgresql://${config.user}:***@${config.host}:${config.port}/${config.database}\n`,
  )

  const shutdown = async () => {
    process.stdout.write('[embedded-postgres] shutting down.\n')
    await pg.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })

  await new Promise(() => {
    // Keep the database alive until the process is explicitly terminated.
  })
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(1)
})
