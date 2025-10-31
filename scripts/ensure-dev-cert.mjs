#!/usr/bin/env node
/**
 * ensure-dev-cert.mjs
 * Erzeugt bei Bedarf ein self-signed Dev-Zertifikat unter cert/dev.key & cert/dev.crt
 * Nutzung: node scripts/ensure-dev-cert.mjs
 * Oder automatisch via npm script vor dem Start.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

const certDir = path.resolve('cert');
const keyPath = path.join(certDir, 'dev.key');
const crtPath = path.join(certDir, 'dev.crt');

// Hinweis: Bekannte Probleme mit Node >=22 bei TLS + WebSocket Upgrade ("shouldUpgradeCallback" Fehler).
// Empfehlung: Für lokale Entwicklung Node 18 oder 20 LTS nutzen, falls HTTPS/HMR Probleme auftreten.
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 22) {
  log(`Warnung: Node ${process.versions.node} erkannt. Falls beim Start TLS/HMR Fehler (shouldUpgradeCallback) auftreten, wechsle auf Node 20 LTS.`);
}

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[dev-cert] ${msg}`);
}

if (!existsSync(certDir)) {
  mkdirSync(certDir, { recursive: true });
  log(`Ordner erstellt: ${certDir}`);
}

if (existsSync(keyPath) && existsSync(crtPath)) {
  log('Zertifikatsdateien vorhanden, nichts zu tun.');
  process.exit(0);
}

function have(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function createWithOpenssl() {
  log('Versuche openssl...');
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${keyPath} -out ${crtPath} -days 365 -subj "/CN=localhost"`, { stdio: 'inherit' });
  log('Zertifikat via openssl erstellt.');
}

function createSelfSignedFallback() {
  log('Nutze selfsigned Fallback...');
  const require = createRequire(import.meta.url);
  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch (e) {
    log('selfsigned Modul nicht installiert. Bitte: npm install --save-dev selfsigned');
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  }
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048, algorithm: 'sha256' });
  writeFileSync(keyPath, pems.private, { mode: 0o600 });
  writeFileSync(crtPath, pems.cert);
  log('Zertifikat via selfsigned erstellt.');
}

log('Erzeuge Dev-Zertifikat (gültig 365 Tage) ...');
try {
  if (have('openssl')) {
    createWithOpenssl();
  } else {
    createSelfSignedFallback();
  }
  log('Setze Environment Variablen für aktuelle Session (nur Hinweis):');
  log('  export VITE_HTTPS=1');
  log(`  export VITE_SSL_KEY=${keyPath}`);
  log(`  export VITE_SSL_CERT=${crtPath}`);
} catch (err) {
  log('Fehler bei der Zertifikatserzeugung.');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
