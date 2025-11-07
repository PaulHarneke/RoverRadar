import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? process.env.SERVER_PORT ?? 5000);
const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(baseDir, 'dist');
const indexFile = path.join(distDir, 'index.html');

const nodeRedBase = process.env.NODE_RED_BASE_URL;
const nodeRedPath = process.env.NODE_RED_TELEMETRY_PATH ?? '/uwb/rover/telemetry';
const nodeRedUrl = nodeRedBase ? new URL(nodeRedPath, ensureTrailingSlash(nodeRedBase)).toString() : null;
const pollInterval = Number(process.env.TELEMETRY_POLL_INTERVAL_MS ?? '500');

let latestTelemetry = null;
let lastTelemetryError = null;

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

if (!nodeRedUrl) {
  console.warn('[server] NODE_RED_BASE_URL is not defined. /api/telemetry will respond with 503 until it is configured.');
} else {
  startTelemetryPolling();
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  if (req.url.startsWith('/api/telemetry')) {
    await handleTelemetryRequest(res);
    return;
  }

  if (req.method === 'GET') {
    await serveStaticFile(req.url, res);
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(port, () => {
  console.log(`[server] listening on port ${port}`);
  if (nodeRedUrl) {
    console.log(`[server] proxying Node-RED telemetry from ${nodeRedUrl}`);
  }
});

async function handleTelemetryRequest(res) {
  if (!nodeRedUrl) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'NODE_RED_BASE_URL is not configured on the server' }));
    return;
  }

  try {
    if (!latestTelemetry) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      const error = lastTelemetryError ? lastTelemetryError.message : 'Telemetry not yet available';
      res.end(JSON.stringify({ error }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.end(latestTelemetry);
  } catch (error) {
    console.error('[server] Telemetry proxy error:', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to fetch telemetry from Node-RED' }));
  }
}

async function serveStaticFile(requestPath, res) {
  if (!fs.existsSync(distDir)) {
    res.statusCode = 404;
    res.end('Static assets not built. Run `npm run build` first.');
    return;
  }

  const safePath = sanitizePath(requestPath);
  const filePath = safePath ?? indexFile;

  try {
    const stream = fs.createReadStream(filePath);
    stream.on('open', () => {
      res.statusCode = 200;
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Content-Type', getContentType(filePath));
    });
    stream.on('error', (error) => {
      if (error.code === 'ENOENT') {
        serveIndex(res);
        return;
      }
      console.error('[server] Static file error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  } catch (error) {
    console.error('[server] Static file exception:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}

function sanitizePath(requestPath) {
  const urlPath = requestPath.split('?')[0];
  if (urlPath === '/' || urlPath === '') {
    return indexFile;
  }
  const resolved = path.join(distDir, path.normalize(urlPath));
  if (!resolved.startsWith(distDir)) {
    return null;
  }
  return resolved;
}

function serveIndex(res) {
  fs.createReadStream(indexFile)
    .on('open', () => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    })
    .on('error', (error) => {
      console.error('[server] Index file error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    })
    .pipe(res);
}

function startTelemetryPolling() {
  const fetchLoop = async () => {
    try {
      const response = await fetch(nodeRedUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }
      latestTelemetry = await response.text();
      lastTelemetryError = null;
    } catch (error) {
      lastTelemetryError = error instanceof Error ? error : new Error(String(error));
      console.error('[server] Telemetry fetch failed:', lastTelemetryError.message);
    } finally {
      setTimeout(fetchLoop, pollInterval);
    }
  };

  fetchLoop().catch((error) => {
    console.error('[server] Initial telemetry fetch failed:', error);
  });
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    case '.json':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
