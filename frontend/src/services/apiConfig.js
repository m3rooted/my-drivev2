export const resolveApiBaseUrl = (reactAppApiUrl, viteApiUrl, nodeEnv = 'development') =>
  reactAppApiUrl || viteApiUrl || (nodeEnv === 'production' ? '/api' : 'http://127.0.0.1:5000/api');
