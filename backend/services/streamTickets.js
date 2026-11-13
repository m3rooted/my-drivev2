const { randomBytes } = require('node:crypto');

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_ACTIVE_TICKETS = 10_000;

const createStreamTicketStore = ({
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
  maxActiveTickets = DEFAULT_MAX_ACTIVE_TICKETS
} = {}) => {
  const tickets = new Map();
  const ticketLimit = Number.isInteger(maxActiveTickets) && maxActiveTickets > 0
    ? maxActiveTickets
    : DEFAULT_MAX_ACTIVE_TICKETS;

  const removeExpiredTickets = () => {
    const currentTime = now();
    for (const [token, ticket] of tickets) {
      if (ticket.expiresAt <= currentTime) tickets.delete(token);
    }
  };

  return {
    issue(userId) {
      if (typeof userId !== 'string' || !userId) {
        throw new TypeError('A user ID is required to issue a stream ticket');
      }

      removeExpiredTickets();
      while (tickets.size >= ticketLimit) {
        tickets.delete(tickets.keys().next().value);
      }

      const token = randomBytes(32).toString('base64url');
      const expiresAt = now() + ttlMs;
      tickets.set(token, { userId, expiresAt });
      return { token, expiresAt: new Date(expiresAt).toISOString() };
    },

    consume(token) {
      if (typeof token !== 'string' || !token) return null;

      const entry = tickets.get(token);
      tickets.delete(token);
      if (!entry || entry.expiresAt <= now()) return null;
      return entry.userId;
    }
  };
};

module.exports = createStreamTicketStore;
