const MAX_TIMER_DELAY_MS = 2_147_483_647;

const scheduleAt = (callback, targetTime, {
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) => {
  if (typeof callback !== 'function' || !Number.isFinite(targetTime)) {
    throw new TypeError('A callback and finite target time are required');
  }

  let handle;
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    const remaining = targetTime - now();
    if (remaining <= 0) {
      callback();
      return;
    }
    handle = setTimeoutFn(tick, Math.min(remaining, MAX_TIMER_DELAY_MS));
  };

  handle = setTimeoutFn(tick, Math.min(Math.max(0, targetTime - now()), MAX_TIMER_DELAY_MS));
  return () => {
    cancelled = true;
    if (handle !== undefined) clearTimeoutFn(handle);
  };
};

module.exports = { MAX_TIMER_DELAY_MS, scheduleAt };
