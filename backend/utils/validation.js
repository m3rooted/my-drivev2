const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 72;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeEmail = (value) => typeof value === 'string'
  ? value.trim().toLowerCase()
  : '';

const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
};

const isValidPassword = (value) => typeof value === 'string' &&
  value.length >= MIN_PASSWORD_LENGTH &&
  Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;

const normalizeDisplayName = (value, maxLength = 255) => {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > maxLength || CONTROL_CHARACTERS.test(name)) return null;
  return name;
};

const parseDateTime = (value) => {
  if (value === undefined || value === null || value === '') return { valid: true, value: null };
  if (typeof value !== 'string' || value.length > 64) return { valid: false, value: null };
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return { valid: false, value: null };
  return { valid: true, value: new Date(timestamp).toISOString() };
};

module.exports = {
  isRecord,
  isValidEmail,
  isValidPassword,
  normalizeDisplayName,
  normalizeEmail,
  parseDateTime
};
