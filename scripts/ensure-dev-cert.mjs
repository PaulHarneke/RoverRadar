#!/usr/bin/env node
/**
 * ensure-dev-cert.mjs
 * Erzeugt bei Bedarf ein self-signed Dev-Zertifikat unter cert/dev.key & cert/dev.crt
 * Nutzung: node scripts/ensure-dev-cert.mjs
 * Oder automatisch via npm script vor dem Start.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import crypto from 'crypto';

const certDir = path.resolve('cert');
const keyPath = path.join(certDir, 'dev.key');
const crtPath = path.join(certDir, 'dev.crt');
const opensslConfigPath = path.join(certDir, '.dev-cert.openssl.cnf');

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

function readPem(pathLike) {
  try {
    return readFileSync(pathLike, 'utf8');
  } catch {
    return null;
  }
}

function extractModulusWithOpenssl(pem, type) {
  // type: 'x509' | 'rsa'
  try {
    const tmpBase = path.join(certDir, `.__tmp_${type}`);
    writeFileSync(tmpBase, pem);
    const cmd = type === 'x509'
      ? `openssl x509 -noout -modulus -in ${tmpBase}`
      : `openssl rsa -noout -modulus -in ${tmpBase}`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    return out.replace(/^Modulus=/, '');
  } catch {
    return null;
  }
}

function fingerprintPublicKeyFromCert(certPem) {
  try {
    const x509 = crypto.X509Certificate.fromPEM(certPem);
    const derPub = x509.publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(derPub).digest('hex');
  } catch {
    return null;
  }
}

function fingerprintPublicKeyFromKey(keyPem) {
  try {
    const keyObj = crypto.createPrivateKey(keyPem);
    const pub = crypto.createPublicKey(keyObj).export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(pub).digest('hex');
  } catch {
    return null;
  }
}

function keyCertMatch() {
  if (!existsSync(keyPath) || !existsSync(crtPath)) return false;
  const keyPem = readPem(keyPath);
  const crtPem = readPem(crtPath);
  if (!keyPem || !crtPem) return false;

  // Prefer OpenSSL modulus comparison if available for consistency
  if (have('openssl')) {
    const keyMod = extractModulusWithOpenssl(keyPem, 'rsa');
    const crtMod = extractModulusWithOpenssl(crtPem, 'x509');
    if (keyMod && crtMod) {
      const match = keyMod === crtMod;
      if (!match) {
        log('Modulus mismatch erkannt (openssl).');
      }
      return match;
    }
  }
  // Fallback: compare public key fingerprints via Node crypto.
  const fpKey = fingerprintPublicKeyFromKey(keyPem);
  const fpCert = fingerprintPublicKeyFromCert(crtPem);
  if (!fpKey || !fpCert) return false;
  const match = fpKey === fpCert;
  if (!match) {
    log('Fingerprint mismatch erkannt (Node crypto).');
  }
  return match;
}

const force = process.env.REGENERATE_DEV_CERT === '1';
if (force) {
  log('Erzwungene Regeneration wegen REGENERATE_DEV_CERT=1.');
}
if (!force && existsSync(keyPath) && existsSync(crtPath) && keyCertMatch()) {
  const keyPemDbg = readPem(keyPath);
  const crtPemDbg = readPem(crtPath);
  const fpKeyDbg = fingerprintPublicKeyFromKey(keyPemDbg);
  const fpCertDbg = fingerprintPublicKeyFromCert(crtPemDbg);
  if (fpKeyDbg && fpCertDbg) {
    log(`Fingerprints (SHA256 SPKI) key=${fpKeyDbg.substring(0,16)}… cert=${fpCertDbg.substring(0,16)}…`);
  }
  log('Zertifikatsdateien vorhanden & stimmen überein – nichts zu tun.');
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
  log('Versuche openssl zur Zertifikat-Erzeugung...');
  // Support optional mkcert (nicer for browsers) if installed
  if (have('mkcert')) {
    try {
      log('mkcert gefunden – erstelle lokales Zertifikat (Root CA notwendig, siehe mkcert README)...');
      // mkcert writes files we specify; ensures SANs for localhost
      execSync(`mkcert -key-file ${keyPath} -cert-file ${crtPath} localhost 127.0.0.1 ::1`, { stdio: 'inherit' });
      log('Zertifikat via mkcert erstellt.');
      return;
    } catch (e) {
      log('mkcert fehlgeschlagen, fallback auf self-signed openssl.');
    }
  }
  writeOpenSslConfig();
  execSync(
    `openssl req -config ${opensslConfigPath} -x509 -newkey rsa:2048 -nodes -keyout ${keyPath} -out ${crtPath} -days 365`,
    { stdio: 'inherit' }
  );
  log('Self-signed Zertifikat via openssl erstellt.');
}

function writeOpenSslConfig() {
  const config = `# Auto-generierte Konfiguration für Dev-Zertifikat\n` +
`[req]\n` +
`default_bits = 2048\n` +
`prompt = no\n` +
`default_md = sha256\n` +
`distinguished_name = dn\n` +
`x509_extensions = v3_req\n` +
`\n` +
`[dn]\n` +
`CN = localhost\n` +
`\n` +
`[v3_req]\n` +
`subjectAltName = @alt_names\n` +
`\n` +
`[alt_names]\n` +
`DNS.1 = localhost\n` +
`IP.1 = 127.0.0.1\n` +
`IP.2 = ::1\n`;
  writeFileSync(opensslConfigPath, config);
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

if (existsSync(keyPath) && existsSync(crtPath) && !force) {
  log('Regeneriere Dev-Zertifikat wegen Mismatch ...');
} else if (force) {
  log('Regeneriere Dev-Zertifikat (force) ...');
} else {
  log('Erzeuge Dev-Zertifikat (gültig 365 Tage) ...');
}
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
