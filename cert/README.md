# Entwicklungs-HTTPS Zertifikate

Diese Dateien dienen nur lokal.

## Self-Signed Zertifikat erzeugen

```bash
openssl req -x509 -newkey rsa:2048 -nodes -keyout dev.key -out dev.crt -days 365 -subj "/CN=localhost"
```

Danach `VITE_HTTPS=1` setzen, optional Pfade:

```bash
export VITE_HTTPS=1
export VITE_SSL_KEY=cert/dev.key
export VITE_SSL_CERT=cert/dev.crt
npm run dev
```

Browser zeigt Warnung (self-signed) -> einmal akzeptieren.

## Optional: mkcert nutzen

Falls `mkcert` installiert ist (empfohlen für weniger Browser-Warnungen):

```bash
mkcert -key-file dev.key -cert-file dev.crt localhost 127.0.0.1 ::1
```

Installationshinweise siehe mkcert GitHub-Repository (Root CA einmalig vertrauen).

## Key/Certificate Mismatch Fehler

Fehlerbild beim Start:

```
Error: error:05800074:x509 certificate routines::key values mismatch
```

Ursache: `dev.key` passt kryptografisch nicht zu `dev.crt` (Modulus unterschiedlich).

### Prüfen ob Key & Cert zusammen passen

```bash
openssl rsa -noout -modulus -in dev.key | shasum
openssl x509 -noout -modulus -in dev.crt | shasum
```

Beide Hashes müssen identisch sein. Wenn nicht:

```bash
rm dev.key dev.crt
node ../scripts/ensure-dev-cert.mjs
```

Script regeneriert automatisch wenn ein Mismatch erkannt wird (ab aktualisierter Version).

### Erneute Erzeugung erzwingen

Setze die Umgebungsvariable:

```bash
REGENERATE_DEV_CERT=1 npm run dev:https
```

Das Script erzeugt immer neue Dateien, selbst wenn die alten gültig waren.

### Fingerprint Debug

Bei erfolgreichem Match loggt das Script einen gekürzten SHA256 SPKI Fingerprint von Key & Cert. Bei Problemen (Mismatch) werden ausführliche Debug-Ausgaben generiert.

## Node Version Hinweis

Bei Node >= 22 gab es Probleme mit TLS/WebSocket Upgrade ("shouldUpgradeCallback"). Für lokale HTTPS-Entwicklung ggf. Node 20 LTS verwenden. Das Script gibt eine Warnung aus falls eine neuere Major-Version erkannt wird.

## Sicherheit
- Key nicht ins Repo für Produktion.
- Für echte Deployments ein gültiges Zertifikat (z.B. Let's Encrypt) verwenden.
