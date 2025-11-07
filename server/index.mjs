import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT ?? process.env.SERVER_PORT ?? 5000);
const baseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(baseDir, 'dist');
const indexFile = path.join(distDir, 'index.html');

const serveStaticAssets = !parseBoolean(process.env.SERVER_DISABLE_STATIC, false);
if (!serveStaticAssets) {
  console.log('[server] Static file serving disabled (SERVER_DISABLE_STATIC=1). Only API endpoints are available.');
}

const nodeRedBase = process.env.NODE_RED_BASE_URL;
const nodeRedPath = process.env.NODE_RED_TELEMETRY_PATH ?? '/uwb/rover/telemetry';
const nodeRedUrl = nodeRedBase ? new URL(nodeRedPath, ensureTrailingSlash(nodeRedBase)).toString() : null;
const pollInterval = Number(process.env.TELEMETRY_POLL_INTERVAL_MS ?? '500');
const nodeRedControlUrlEnv = process.env.NODE_RED_HTTP_URL;
const nodeRedControlUrl = nodeRedControlUrlEnv === '' ? null : nodeRedControlUrlEnv ?? 'http://127.0.0.1:1880/joystick';
const nodeRedControlTimeoutMs = Number(process.env.NODE_RED_HTTP_TIMEOUT_MS ?? '5000');
const nodeRedRetryCooldownMs = Number(process.env.NODE_RED_RETRY_COOLDOWN_MS ?? '10000');
const nodeRedThrottleMs = Number(process.env.NODE_RED_PUSH_MIN_INTERVAL_MS ?? '50');
const nodeRedSourceId = process.env.NODE_RED_SOURCE_ID ?? 'rover-radar';

let latestTelemetry = null;
let lastTelemetryError = null;
let controlState = {
  mode: 'idle',
  stick: { x: 0, y: 0 },
  ts: new Date().toISOString(),
  source: nodeRedSourceId
};
let controlDirty = false;
let controlRevision = 0;
let nodeRedPushTimer = null;
let nodeRedCooldownUntil = 0;
let nodeRedCooldownLogged = false;
let nodeRedInFlight = false;
let lastNodeRedPushTs = 0;

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

if (!nodeRedUrl) {
  console.warn('[server] NODE_RED_BASE_URL is not defined. /api/telemetry will respond with 503 until it is configured.');
} else {
  startTelemetryPolling();
}

if (nodeRedControlUrl) {
  console.log(`[server] Node-RED control forwarding enabled (${nodeRedControlUrl})`);
} else {
  console.log('[server] Node-RED control forwarding disabled (NODE_RED_HTTP_URL empty).');
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

  if (req.url.startsWith('/api/control')) {
    await handleControlRequest(req, res);
    return;
  }

  if (req.method === 'GET') {
    if (serveStaticAssets) {
      await serveStaticFile(req.url, res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
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
  if (nodeRedControlUrl) {
    console.log(`[server] pushing control state updates to ${nodeRedControlUrl}`);
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
  if (!serveStaticAssets) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

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

async function handleControlRequest(req, res) {
  if (req.method === 'GET') {
    handleControlGet(res);
    return;
  }

  if (req.method === 'POST') {
    await handleControlPost(req, res);
    return;
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, POST');
  res.end('Method Not Allowed');
}

function handleControlGet(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(controlState));
}

async function handleControlPost(req, res) {
  try {
    const payload = await readJsonBody(req);
    const update = normalizeControlUpdate(payload);
    updateControlState(update);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(controlState));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}

async function readJsonBody(req) {
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req
      .on('data', (chunk) => {
        data += chunk;
      })
      .on('end', () => resolve(data))
      .on('error', reject);
  });

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Request body must be valid JSON');
  }
}

function normalizeControlUpdate(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Request body must be an object');
  }

  const update = {};

  if (Object.prototype.hasOwnProperty.call(candidate, 'mode')) {
    const mode = candidate.mode;
    if (typeof mode !== 'string' || mode.trim() === '') {
      throw new Error('mode must be a non-empty string');
    }
    update.mode = mode;
  }

  if (Object.prototype.hasOwnProperty.call(candidate, 'stick')) {
    const stick = candidate.stick;
    if (!stick || typeof stick !== 'object') {
      throw new Error('stick must be an object with x and y');
    }
    const x = Number(stick.x);
    const y = Number(stick.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('stick.x and stick.y must be finite numbers');
    }
    update.stick = { x, y };
  }

  if (!('mode' in update) && !('stick' in update)) {
    throw new Error('Payload must include mode and/or stick');
  }

  return update;
}

function updateControlState(update) {
  controlState = {
    mode: update.mode ?? controlState.mode,
    stick: update.stick ? { x: update.stick.x, y: update.stick.y } : controlState.stick,
    ts: new Date().toISOString(),
    source: nodeRedSourceId
  };
  controlDirty = true;
  controlRevision += 1;
  scheduleNodeRedPush();
}

function scheduleNodeRedPush() {
  if (!nodeRedControlUrl || !controlDirty) {
    return;
  }

  const now = Date.now();

  if (nodeRedCooldownUntil > now) {
    if (!nodeRedCooldownLogged) {
      const waitMs = nodeRedCooldownUntil - now;
      console.warn(`[server] Node-RED push paused for ${waitMs} ms after previous error.`);
      nodeRedCooldownLogged = true;
    }
    if (!nodeRedPushTimer) {
      const delay = nodeRedCooldownUntil - now;
      nodeRedPushTimer = setTimeout(() => {
        nodeRedPushTimer = null;
        scheduleNodeRedPush();
      }, delay);
    }
    return;
  }

  const elapsed = now - lastNodeRedPushTs;
  const delay = elapsed >= nodeRedThrottleMs ? 0 : nodeRedThrottleMs - elapsed;

  if (nodeRedPushTimer) {
    return;
  }

  nodeRedPushTimer = setTimeout(() => {
    nodeRedPushTimer = null;
    void postToNodeRed();
  }, delay);
}

async function postToNodeRed() {
  if (!nodeRedControlUrl || !controlDirty || nodeRedInFlight) {
    return;
  }

  nodeRedInFlight = true;
  const revisionAtStart = controlRevision;
  const payload = JSON.stringify(controlState);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), nodeRedControlTimeoutMs);

  try {
    lastNodeRedPushTs = Date.now();
    const response = await fetch(nodeRedControlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }

    if (controlRevision === revisionAtStart) {
      controlDirty = false;
    }
    nodeRedCooldownUntil = 0;
    nodeRedCooldownLogged = false;
  } catch (error) {
    controlDirty = true;
    nodeRedCooldownUntil = Date.now() + nodeRedRetryCooldownMs;
    if (!nodeRedCooldownLogged) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(
        `[server] Node-RED push failed (${reason}). Retrying in ${nodeRedRetryCooldownMs} ms.`
      );
      nodeRedCooldownLogged = true;
    }
  } finally {
    clearTimeout(timeout);
    nodeRedInFlight = false;
    if (controlDirty) {
      scheduleNodeRedPush();
    }
  }
}

function parseBoolean(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === '') {
    return defaultValue;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
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
