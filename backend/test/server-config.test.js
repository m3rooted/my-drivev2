const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

test('refuses to start on non-loopback hosts with the development JWT fallback', () => {
  const previousEnvironment = {
    JWT_SECRET: process.env.JWT_SECRET,
    HOST: process.env.HOST,
    NODE_ENV: process.env.NODE_ENV
  };
  const serverPath = require.resolve('../server');

  try {
    process.env.JWT_SECRET = '';
    process.env.NODE_ENV = 'development';
    for (const host of ['0.0.0.0', '127.attacker.example']) {
      process.env.HOST = host;
      delete require.cache[serverPath];
      assert.throws(() => require('../server'), /JWT_SECRET.*non-loopback/i);
    }
  } finally {
    delete require.cache[serverPath];
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
