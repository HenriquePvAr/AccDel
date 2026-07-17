import process from 'node:process'

import { CainPrintAgent } from './agent.js'
import { loadConfig, loadLocalEnv } from './config.js'

async function main() {
  loadLocalEnv()
  const config = loadConfig()
  const agent = new CainPrintAgent(config)
  process.on('SIGINT', () => agent.stop())
  process.on('SIGTERM', () => agent.stop())
  await agent.start()
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Cain Print Agent failed to start.'
  process.stderr.write(`${message.replace(/[\r\n\t]+/g, ' ').slice(0, 300)}\n`)
  process.exitCode = 1
})
