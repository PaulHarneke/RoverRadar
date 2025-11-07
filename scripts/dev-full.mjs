#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;
let certEnsured = false;

const backendEnv = { ...process.env };
if (!backendEnv.PORT) {
  backendEnv.PORT = backendEnv.DEV_BACKEND_PORT ?? '5100';
}
if (!backendEnv.SERVER_DISABLE_STATIC) {
  backendEnv.SERVER_DISABLE_STATIC = '1';
}
const backendPort = backendEnv.PORT;

enableHttpsForBackend(backendEnv);

const backendProtocol = backendEnv.SERVER_HTTPS === '1' ? 'https' : 'http';
const telemetryUrl =
  process.env.VITE_TELEMETRY_API_URL ?? `${backendProtocol}://127.0.0.1:${backendPort}/api/telemetry`;
const httpPollUrl = process.env.VITE_HTTP_POLL_URL ?? telemetryUrl;

const frontendEnv = { ...process.env };
if (!frontendEnv.VITE_TELEMETRY_API_URL) {
  frontendEnv.VITE_TELEMETRY_API_URL = telemetryUrl;
}
if (!frontendEnv.VITE_HTTP_POLL_URL) {
  frontendEnv.VITE_HTTP_POLL_URL = httpPollUrl;
}

enableHttpsForFrontend(frontendEnv);

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

function enableHttpsForBackend(env) {
  if (env.SERVER_HTTPS === '0') {
    return;
  }

  const defaultKey = path.resolve('cert', 'dev.key');
  const defaultCert = path.resolve('cert', 'dev.crt');
  const shouldEnable = env.SERVER_HTTPS === '1' || env.SERVER_HTTPS === undefined;

  if (!shouldEnable) {
    return;
  }

  ensureDevCertificate();

  env.SERVER_HTTPS = '1';
  env.SERVER_TLS_KEY = env.SERVER_TLS_KEY ?? defaultKey;
  env.SERVER_TLS_CERT = env.SERVER_TLS_CERT ?? defaultCert;
}

function enableHttpsForFrontend(env) {
  const shouldEnable = env.VITE_HTTPS === '1' || env.VITE_HTTPS === undefined;
  if (!shouldEnable) {
    return;
  }

  ensureDevCertificate();

  env.VITE_HTTPS = '1';
  env.VITE_SSL_KEY = env.VITE_SSL_KEY ?? path.resolve('cert', 'dev.key');
  env.VITE_SSL_CERT = env.VITE_SSL_CERT ?? path.resolve('cert', 'dev.crt');
}

function ensureDevCertificate() {
  if (certEnsured) {
    return;
  }

  const result = spawnSync(nodeCommand, ['scripts/ensure-dev-cert.mjs'], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  certEnsured = true;
}
