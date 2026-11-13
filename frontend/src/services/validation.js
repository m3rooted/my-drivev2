export const getPasswordConfirmationError = (password, confirmation) => {
  return password === confirmation ? null : 'Passwords do not match.';
};
