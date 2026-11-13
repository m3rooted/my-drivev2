const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MAX_TIMER_DELAY_MS, scheduleAt } = require('../services/scheduleTimeout');

test('chunks long scheduled delays and fires only when the target time arrives', () => {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const setTimer = (callback, delay) => {
    const id = ++nextId;
    timers.set(id, { callback, delay });
    return id;
  };
  const clearTimer = (id) => timers.delete(id);
  const callback = () => { fired = true; };
  let fired = false;
  const targetTime = (MAX_TIMER_DELAY_MS * 2) + 10;

  scheduleAt(callback, targetTime, { now: () => now, setTimeoutFn: setTimer, clearTimeoutFn: clearTimer });
  assert.equal([...timers.values()][0].delay, MAX_TIMER_DELAY_MS);

  while (timers.size > 0) {
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    now += timer.delay;
    timer.callback();
    if (now < targetTime) assert.equal(fired, false);
  }

  assert.equal(fired, true);
});

test('cancels a long scheduled callback', () => {
  let cleared = false;
  const cancel = scheduleAt(() => assert.fail('cancelled callback ran'), MAX_TIMER_DELAY_MS + 10, {
    now: () => 0,
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => { cleared = true; }
  });

  cancel();
  assert.equal(cleared, true);
});
