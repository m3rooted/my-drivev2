const WINDOW_MS = 60 * 1000;
const REQUESTS_PER_WINDOW = 10;
const userWindows = new Map();

const consumeNotebookChatRequest = (userId, now = Date.now()) => {
  for (const [key, window] of userWindows) {
    if (window.resetAt <= now) userWindows.delete(key);
  }

  let window = userWindows.get(userId);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + WINDOW_MS };
    userWindows.set(userId, window);
  }

  if (window.count >= REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000))
    };
  }

  window.count += 1;
  return { allowed: true, remaining: REQUESTS_PER_WINDOW - window.count };
};

module.exports = { consumeNotebookChatRequest, REQUESTS_PER_WINDOW, WINDOW_MS };
