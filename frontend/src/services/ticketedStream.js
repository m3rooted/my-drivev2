export const connectTicketedStream = ({
  getTicket,
  createSource,
  onConnected = () => {},
  onMessage = () => {},
  onStatusChange = () => {},
  retryDelay = 2000
}) => {
  let stopped = false;
  let source = null;
  let retryTimer = null;

  const scheduleReconnect = () => {
    if (stopped || retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, retryDelay);
  };

  const connect = async () => {
    try {
      const ticket = await getTicket();
      if (stopped) return;

      const nextSource = createSource(ticket);
      source = nextSource;
      nextSource.addEventListener('connected', () => {
        if (!stopped && source === nextSource) onConnected();
      });
      nextSource.addEventListener('notes:update', (event) => {
        if (!stopped && source === nextSource) onMessage(event);
      });
      nextSource.onerror = () => {
        if (source !== nextSource) return;
        source = null;
        nextSource.close();
        onStatusChange(false);
        scheduleReconnect();
      };
    } catch {
      onStatusChange(false);
      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (retryTimer !== null) clearTimeout(retryTimer);
    source?.close();
    source = null;
  };
};
