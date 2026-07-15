import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const require = createRequire(join(root, 'apps', 'api', 'package.json'))
const { Client } = require('pg')
const databaseName = process.argv[2] ?? ''
const sourceUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ''

if (!/^accdel_[a-z0-9_]*test$/.test(databaseName)) {
  throw new Error('O banco isolado deve seguir accdel_*test.')
}
const url = new URL(sourceUrl)
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
  throw new Error('O utilitario aceita somente PostgreSQL local.')
}
url.pathname = '/postgres'
url.search = ''

const client = new Client({ connectionString: url.toString() })
await client.connect()
try {
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName])
  if (existing.rowCount) throw new Error(`O banco ${databaseName} ja existe.`)
  await client.query(`CREATE DATABASE "${databaseName}"`)
  console.log(JSON.stringify({ event: 'isolated_test_database_created', databaseName }))
} finally {
  await client.end()
}
