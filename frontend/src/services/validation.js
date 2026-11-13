export const getPasswordConfirmationError = (password, confirmation) => {
  return password === confirmation ? null : 'Passwords do not match.';
};

export const getInviteCodeValidationError = (inviteCode, isRequired) => {
  return isRequired && (typeof inviteCode !== 'string' || !inviteCode.trim())
    ? 'Enter your invitation code.'
    : null;
};

const getUtf8ByteLength = (value) => {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return byteLength;
};

export const getRegistrationValidationError = (password, confirmation) => {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters.';
  }

  if (getUtf8ByteLength(password) > 72) {
    return 'Password must be 72 UTF-8 bytes or fewer.';
  }

  return getPasswordConfirmationError(password, confirmation);
};
