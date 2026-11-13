const { timingSafeEqual } = require('node:crypto');
const { isValidEmail, normalizeEmail } = require('./validation');

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
};

const parseRegistrationInvites = (value) => {
  const invites = new Map();
  const codes = new Set();
  if (typeof value !== 'string') return { invites, valid: false };
  if (!value.trim()) return { invites, valid: true };

  let valid = true;
  for (const entry of value.split(',')) {
    const separator = entry.lastIndexOf(':');
    const email = normalizeEmail(entry.slice(0, separator));
    const code = separator < 0 ? '' : entry.slice(separator + 1).trim();

    if (
      separator <= 0
      || !isValidEmail(email)
      || Buffer.byteLength(code, 'utf8') < 32
      || /replace-with|change-me|placeholder/i.test(code)
      || invites.has(email)
      || codes.has(code)
    ) {
      valid = false;
      continue;
    }

    invites.set(email, code);
    codes.add(code);
  }

  return { invites, valid };
};

const isRegistrationAllowed = (email, configuredInvites) => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) return false;

  return parseRegistrationInvites(configuredInvites).invites.has(normalizedEmail);
};

const isRegistrationInviteValid = (email, providedCode, configuredInvites) => {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail) || typeof providedCode !== 'string') return false;

  const configuredCode = parseRegistrationInvites(configuredInvites).invites.get(normalizedEmail);
  if (!configuredCode) return false;

  const provided = Buffer.from(providedCode, 'utf8');
  const configured = Buffer.from(configuredCode, 'utf8');
  return provided.length === configured.length && timingSafeEqual(provided, configured);
};

const validateProductionConfig = (env) => {
  if (env.NODE_ENV !== 'production') return;

  const corsOrigins = typeof env.CORS_ORIGINS === 'string'
    ? env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];
  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must list the deployed frontend origin in production');
  }

  for (const origin of corsOrigins) {
    const url = isHttpsUrl(origin);
    if (!url || url.origin !== origin || url.pathname !== '/') {
      throw new Error('CORS_ORIGINS entries must be HTTPS origins without paths in production');
    }
  }

  const apiUrl = isHttpsUrl(env.PUBLIC_API_URL || '');
  if (!apiUrl || !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api')) {
    throw new Error('PUBLIC_API_URL must be set to the public HTTPS API base URL ending in /api');
  }

  if (typeof env.REGISTRATION_INVITES !== 'string') {
    throw new Error('REGISTRATION_INVITES must be set in production; use an empty value to disable signups');
  }
  if (!parseRegistrationInvites(env.REGISTRATION_INVITES).valid) {
    throw new Error('REGISTRATION_INVITES entries must contain unique valid emails and codes of at least 32 bytes');
  }
};

module.exports = { isRegistrationAllowed, isRegistrationInviteValid, validateProductionConfig };
