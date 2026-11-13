process.env.JWT_SECRET = 'test-only-secret-with-enough-entropy';

const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { after, test } = require('node:test');
const auth = require('../middleware/auth');

const app = express();
app.get('/private', auth, (req, res) => res.json({ userId: req.user.id }));
const server = app.listen(0, '127.0.0.1');
const serverReady = new Promise((resolve) => server.once('listening', resolve));

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('rejects access tokens supplied in the URL query string', async () => {
  await serverReady;
  const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/private?token=${encodeURIComponent(token)}`);

  assert.equal(response.status, 401);
});

test('accepts a valid bearer token in the Authorization header', async () => {
  await serverReady;
  const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/private`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: 'user-1' });
});
