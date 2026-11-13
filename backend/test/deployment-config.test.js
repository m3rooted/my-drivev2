const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  isRegistrationAllowed,
  isRegistrationInviteValid,
  validateProductionConfig
} = require('../utils/runtimeConfig');

const validProductionConfig = {
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://drive.example.com',
  PUBLIC_API_URL: 'https://drive.example.com/api',
  REGISTRATION_INVITES: 'owner@example.com:owner-invite-code-secret-over-32-bytes,member@example.com:member-invite-code-secret-over-32-bytes',
  JWT_SECRET: 'a-random-production-secret-with-more-than-32-bytes'
};

test('accepts explicit HTTPS frontend and API addresses in production', () => {
  assert.doesNotThrow(() => validateProductionConfig(validProductionConfig));
});

test('requires a non-empty explicit CORS origin list in production', () => {
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, CORS_ORIGINS: '' }),
    /CORS_ORIGINS must list the deployed frontend origin/
  );
});

test('rejects non-HTTPS or non-origin entries in production CORS configuration', () => {
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, CORS_ORIGINS: 'http://drive.example.com' }),
    /CORS_ORIGINS entries must be HTTPS origins/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, CORS_ORIGINS: 'https://drive.example.com/path' }),
    /CORS_ORIGINS entries must be HTTPS origins/
  );
});

test('requires a public HTTPS API base URL ending in /api', () => {
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, PUBLIC_API_URL: '' }),
    /PUBLIC_API_URL must be set to the public HTTPS API base URL/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, PUBLIC_API_URL: 'http://drive.example.com/api' }),
    /PUBLIC_API_URL must be set to the public HTTPS API base URL/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, PUBLIC_API_URL: 'https://drive.example.com' }),
    /PUBLIC_API_URL must be set to the public HTTPS API base URL/
  );
});

test('requires an explicit email-bound invite map and rejects malformed entries', () => {
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, REGISTRATION_INVITES: undefined }),
    /REGISTRATION_INVITES must be set in production/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, REGISTRATION_INVITES: 'not-an-email:invite-code-secret-over-32-bytes' }),
    /REGISTRATION_INVITES entries must contain unique valid emails and codes/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, REGISTRATION_INVITES: 'owner@example.com:short' }),
    /REGISTRATION_INVITES entries must contain unique valid emails and codes/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, REGISTRATION_INVITES: 'owner@example.com:first-invite-code-secret-over-32-bytes,OWNER@example.com:second-invite-code-secret-over-32-bytes' }),
    /REGISTRATION_INVITES entries must contain unique valid emails and codes/
  );
  assert.throws(
    () => validateProductionConfig({ ...validProductionConfig, REGISTRATION_INVITES: 'owner@example.com:shared-invite-code-secret-over-32-bytes,member@example.com:shared-invite-code-secret-over-32-bytes' }),
    /REGISTRATION_INVITES entries must contain unique valid emails and codes/
  );
  assert.doesNotThrow(() => validateProductionConfig({ ...validProductionConfig, REGISTRATION_INVITES: '' }));
});

test('limits registration to normalized addresses in the allowlist', () => {
  assert.equal(typeof isRegistrationAllowed, 'function');
  assert.equal(isRegistrationAllowed('OWNER@EXAMPLE.COM', validProductionConfig.REGISTRATION_INVITES), true);
  assert.equal(isRegistrationAllowed('outsider@example.com', validProductionConfig.REGISTRATION_INVITES), false);
  assert.equal(isRegistrationAllowed('owner@example.com', ''), false);
});

test('validates each invitation code only for its associated email', () => {
  assert.equal(typeof isRegistrationInviteValid, 'function');
  const ownerCode = 'owner-invite-code-secret-over-32-bytes';
  const memberCode = 'member-invite-code-secret-over-32-bytes';
  assert.equal(isRegistrationInviteValid('OWNER@EXAMPLE.COM', ownerCode, validProductionConfig.REGISTRATION_INVITES), true);
  assert.equal(isRegistrationInviteValid('member@example.com', memberCode, validProductionConfig.REGISTRATION_INVITES), true);
  assert.equal(isRegistrationInviteValid('member@example.com', ownerCode, validProductionConfig.REGISTRATION_INVITES), false);
  assert.equal(isRegistrationInviteValid('outsider@example.com', ownerCode, validProductionConfig.REGISTRATION_INVITES), false);
  assert.equal(isRegistrationInviteValid('owner@example.com', ownerCode, ''), false);
});

test('leaves local development configuration unrestricted by production URL requirements', () => {
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'development' }));
});
