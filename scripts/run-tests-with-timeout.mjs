#!/usr/bin/env node
/**
 * run-tests-with-timeout.mjs
 *
 * Wrapper cross-platform para executar comandos de teste com timeout global.
 * Substitui o comando Unix `timeout` para compatibilidade com Windows/macOS/Linux.
 *
 * Uso:
 *   node scripts/run-tests-with-timeout.mjs <timeout_seconds> <command> [args...]
 *
 * Ou via env var:
 *   TEST_TIMEOUT=600 node scripts/run-tests-with-timeout.mjs <command> [args...]
 *
 * Exit codes:
 *   0   - Sucesso
 *   1   - Falha no comando
 *   124 - Timeout (compatível com GNU timeout)
 */

import { spawn } from 'node:child_process'

// Parse arguments: node script.mjs [timeout_seconds] command [args...]
const args = process.argv.slice(2)

let timeoutSeconds
let commandArgs

// First arg may be a number (timeout in seconds) or the command itself
if (args.length > 0 && /^\d+$/.test(args[0])) {
  timeoutSeconds = parseInt(args[0], 10)
  commandArgs = args.slice(1)
} else {
  // Fall back to TEST_TIMEOUT env var or default of 600s (10 minutes)
  timeoutSeconds = parseInt(process.env.TEST_TIMEOUT || '600', 10)
  commandArgs = args
}

if (commandArgs.length === 0) {
  console.error('Usage: run-tests-with-timeout.mjs [timeout_seconds] <command> [args...]')
  process.exit(1)
}

const [command, ...restArgs] = commandArgs
const timeoutMs = timeoutSeconds * 1000

console.log(`[timeout-wrapper] Timeout: ${timeoutSeconds}s | Command: ${command} ${restArgs.join(' ')}`)

const child = spawn(command, restArgs, {
  stdio: 'inherit',
  shell: false,
})

let timedOut = false

const timer = setTimeout(() => {
  timedOut = true
  console.error(`\n[timeout-wrapper] TIMEOUT after ${timeoutSeconds}s — killing process tree`)

  // SIGTERM first — allows graceful shutdown
  child.kill('SIGTERM')

  // SIGKILL after 5s if process didn't exit
  setTimeout(() => {
    if (!child.killed) {
      console.error('[timeout-wrapper] Force killing with SIGKILL')
      child.kill('SIGKILL')
    }
  }, 5000)
}, timeoutMs)

// Prevent timer from keeping Node alive if child exits normally
timer.unref()

child.on('close', (code, signal) => {
  clearTimeout(timer)

  if (timedOut) {
    console.error(`[timeout-wrapper] Process killed after ${timeoutSeconds}s timeout`)
    process.exit(124)
  }

  if (signal) {
    console.error(`[timeout-wrapper] Process killed by signal: ${signal}`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})

child.on('error', (err) => {
  clearTimeout(timer)
  console.error(`[timeout-wrapper] Failed to start process: ${err.message}`)
  process.exit(1)
})
