import { getPasswordConfirmationError, getRegistrationValidationError } from './validation';

test('returns an inline validation message when registration passwords differ', () => {
  expect(getPasswordConfirmationError('correct horse battery staple', 'different password'))
    .toBe('Passwords do not match.');
});

test('accepts matching registration passwords', () => {
  expect(getPasswordConfirmationError('correct horse battery staple', 'correct horse battery staple'))
    .toBeNull();
});

test('requires the same minimum password length as the API', () => {
  expect(getRegistrationValidationError('short123', 'short123'))
    .toBe('Password must be at least 12 characters.');
  expect(getRegistrationValidationError('twelve chars', 'twelve chars')).toBeNull();
});

test('rejects registration passwords over the API UTF-8 byte limit', () => {
  expect(getRegistrationValidationError('é'.repeat(37), 'é'.repeat(37)))
    .toBe('Password must be 72 UTF-8 bytes or fewer.');
});

test('reports mismatched passwords after checking password constraints', () => {
  expect(getRegistrationValidationError('twelve chars', 'another value'))
    .toBe('Passwords do not match.');
});
