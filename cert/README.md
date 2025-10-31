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

## Sicherheit
- Key nicht ins Repo für Produktion.
- Für echte Deployments ein gültiges Zertifikat (z.B. Let's Encrypt) verwenden.
