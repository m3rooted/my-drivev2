const assert = require('node:assert/strict');
const { test } = require('node:test');
const createStreamTicketStore = require('../services/streamTickets');

test('stream tickets authorize one connection and cannot be replayed', () => {
  const tickets = createStreamTicketStore({ now: () => 1000 });
  const { token } = tickets.issue('user-1');

  assert.equal(tickets.consume(token), 'user-1');
  assert.equal(tickets.consume(token), null);
});

test('stream tickets expire after their short lifetime', () => {
  let now = 1000;
  const tickets = createStreamTicketStore({ ttlMs: 50, now: () => now });
  const { token } = tickets.issue('user-1');

  now = 1050;
  assert.equal(tickets.consume(token), null);
});

test('bounds active ticket memory by evicting the oldest unconsumed ticket', () => {
  const tickets = createStreamTicketStore({ maxActiveTickets: 1 });
  const first = tickets.issue('user-1');
  const second = tickets.issue('user-2');

  assert.equal(tickets.consume(first.token), null);
  assert.equal(tickets.consume(second.token), 'user-2');
});
