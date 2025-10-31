#!/usr/bin/env node
/**
 * ensure-dev-cert.mjs
 * Erzeugt bei Bedarf ein self-signed Dev-Zertifikat unter cert/dev.key & cert/dev.crt
 * Nutzung: node scripts/ensure-dev-cert.mjs
 * Oder automatisch via npm script vor dem Start.
 */
import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const certDir = path.resolve('cert');
const keyPath = path.join(certDir, 'dev.key');
const crtPath = path.join(certDir, 'dev.crt');

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

log('Erzeuge self-signed Zertifikat (gültig 365 Tage) ...');
try {
  // Für Windows Kompatibilität könnte man openssl Pfad prüfen, hier einfache Variante.
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${keyPath} -out ${crtPath} -days 365 -subj "/CN=localhost"`, { stdio: 'inherit' });
  log('Zertifikat erstellt.');
  log('Setze Environment Variablen für aktuelle Session (nur Hinweis):');
  log('  export VITE_HTTPS=1');
  log(`  export VITE_SSL_KEY=${keyPath}`);
  log(`  export VITE_SSL_CERT=${crtPath}`);
} catch (err) {
  log('Fehler bei der Zertifikatserzeugung. Stelle sicher, dass openssl installiert ist.');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
