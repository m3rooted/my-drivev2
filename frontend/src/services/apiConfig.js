export const resolveApiBaseUrl = (reactAppApiUrl, viteApiUrl) =>
  reactAppApiUrl || viteApiUrl || 'http://127.0.0.1:5000/api';
