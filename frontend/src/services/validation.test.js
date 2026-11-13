import { getPasswordConfirmationError } from './validation';

test('returns an inline validation message when registration passwords differ', () => {
  expect(getPasswordConfirmationError('correct horse battery staple', 'different password'))
    .toBe('Passwords do not match.');
});

test('accepts matching registration passwords', () => {
  expect(getPasswordConfirmationError('correct horse battery staple', 'correct horse battery staple'))
    .toBeNull();
});
