#!/usr/bin/env node
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;

const backendEnv = { ...process.env };
if (!backendEnv.PORT) {
  backendEnv.PORT = backendEnv.DEV_BACKEND_PORT ?? '5100';
}
if (!backendEnv.SERVER_DISABLE_STATIC) {
  backendEnv.SERVER_DISABLE_STATIC = '1';
}
const backendPort = backendEnv.PORT;

const telemetryUrl = process.env.VITE_TELEMETRY_API_URL ?? `http://127.0.0.1:${backendPort}/api/telemetry`;
const httpPollUrl = process.env.VITE_HTTP_POLL_URL ?? telemetryUrl;

const frontendEnv = { ...process.env };
if (!frontendEnv.VITE_TELEMETRY_API_URL) {
  frontendEnv.VITE_TELEMETRY_API_URL = telemetryUrl;
}
if (!frontendEnv.VITE_HTTP_POLL_URL) {
  frontendEnv.VITE_HTTP_POLL_URL = httpPollUrl;
}

console.log(`[dev] Backend port: ${backendPort}`);
console.log(`[dev] Frontend telemetry API: ${frontendEnv.VITE_TELEMETRY_API_URL}`);

const children = new Set();
let shuttingDown = false;
let exitCode = 0;

function spawnCommand(name, command, args, env) {
  console.log(`[dev] launching ${name}: ${[command, ...args].join(' ')}`);
  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: isWindows
  });

  children.add(child);

  child.on('exit', (code, signal) => {
    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`[dev] ${name} exited (${detail}).`);
    children.delete(child);

    if (!shuttingDown) {
      exitCode = signal ? 1 : code ?? 0;
      console.log('[dev] Shutting down remaining processes...');
      requestShutdown(exitCode);
    }

    if (shuttingDown && children.size === 0) {
      process.exit(exitCode);
    }
  });

  child.on('error', (error) => {
    console.error(`[dev] Failed to start ${name}:`, error);
    exitCode = 1;
    requestShutdown(exitCode);
  });

  return child;
}

function requestShutdown(code = 0) {
  if (!shuttingDown) {
    shuttingDown = true;
    exitCode = code;
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const terminated = child.kill('SIGTERM');
        if (!terminated && isWindows) {
          child.kill('SIGINT');
        }
      }
    }
  }

  if (children.size === 0) {
    process.exit(exitCode);
  }
}

process.once('SIGINT', () => {
  console.log('\n[dev] Received SIGINT. Shutting down...');
  requestShutdown(0);
});

process.once('SIGTERM', () => {
  console.log('\n[dev] Received SIGTERM. Shutting down...');
  requestShutdown(0);
});

spawnCommand('backend', nodeCommand, ['server/index.mjs'], backendEnv);
spawnCommand('frontend', npmCommand, ['run', 'dev'], frontendEnv);
