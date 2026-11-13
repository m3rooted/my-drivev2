process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy';
process.env.CORS_ORIGINS = 'http://localhost:3001';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const createApp = require('../app');

let server;
let baseUrl;
let uploadsDir;

before(async () => {
  uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-drive-private-uploads-'));
  await fs.writeFile(path.join(uploadsDir, 'private.txt'), 'private fixture');
  process.env.UPLOAD_DIR = uploadsDir;
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  await fs.rm(uploadsDir, { recursive: true, force: true });
});

test('does not expose uploaded files through an unauthenticated static route', async () => {
  const response = await fetch(`${baseUrl}/uploads/private.txt`);

  assert.equal(response.status, 404);
});

test('sets security headers and hides the Express fingerprint', async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('allows only configured browser origins', async () => {
  const allowed = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'http://localhost:3001' } });
  const rejected = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://attacker.example' } });

  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3001');
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});
