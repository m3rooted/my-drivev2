import { resolveApiBaseUrl } from './apiConfig';

test('uses the same IPv4 loopback host the local backend binds to by default', () => {
  expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:5000/api');
});

test('keeps explicit API URL overrides available', () => {
  expect(resolveApiBaseUrl('https://drive.example.test/api', 'https://other.example.test/api'))
    .toBe('https://drive.example.test/api');
  expect(resolveApiBaseUrl('', 'https://other.example.test/api'))
    .toBe('https://other.example.test/api');
});
