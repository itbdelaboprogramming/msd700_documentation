// Minimal GitHub webhook receiver: verifies the push signature and triggers
// scripts/deploy.sh when main is updated. No external dependencies.
// Runs behind Apache (ProxyPass /services/msd700-webhook -> 127.0.0.1:PORT),
// bound to 127.0.0.1 only — never exposed directly to the internet.
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '..');
const DEPLOY_SCRIPT = path.join(__dirname, 'deploy.sh');

const PORT = process.env.PORT || 4701;
const SECRET = process.env.WEBHOOK_SECRET;

if (!SECRET) {
  console.error('WEBHOOK_SECRET is not set. Refusing to start.');
  process.exit(1);
}

function verifySignature(payload, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

function runDeploy() {
  const child = spawn('bash', [DEPLOY_SCRIPT], {
    cwd: REPO_DIR,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    if (!verifySignature(body, req.headers['x-hub-signature-256'])) {
      console.warn(`${new Date().toISOString()} rejected: bad signature`);
      res.writeHead(401);
      res.end('bad signature');
      return;
    }

    const event = req.headers['x-github-event'];
    if (event === 'ping') {
      res.writeHead(200);
      res.end('pong');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      res.writeHead(400);
      res.end('bad json');
      return;
    }

    if (event === 'push' && payload.ref === 'refs/heads/main') {
      console.log(`${new Date().toISOString()} push to main detected, deploying`);
      runDeploy();
      res.writeHead(202);
      res.end('deploying');
    } else {
      res.writeHead(200);
      res.end('ignored');
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`msd700-docs webhook listener on 127.0.0.1:${PORT}`);
});
