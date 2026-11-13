import { connectTicketedStream } from './ticketedStream';

const createSource = () => ({
  addEventListener: jest.fn(),
  close: jest.fn(),
  onerror: null
});

describe('connectTicketedStream', () => {
  afterEach(() => jest.useRealTimers());

  test('requests a fresh single-use ticket after a dropped connection', async () => {
    jest.useFakeTimers();
    const firstSource = createSource();
    const secondSource = createSource();
    const getTicket = jest.fn()
      .mockResolvedValueOnce('ticket-1')
      .mockResolvedValueOnce('ticket-2');
    const createSourceForTicket = jest.fn()
      .mockReturnValueOnce(firstSource)
      .mockReturnValueOnce(secondSource);

    const disconnect = connectTicketedStream({
      getTicket,
      createSource: createSourceForTicket,
      retryDelay: 500
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(getTicket).toHaveBeenCalledTimes(1);
    expect(createSourceForTicket).toHaveBeenCalledWith('ticket-1');

    firstSource.onerror();
    expect(firstSource.close).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(getTicket).toHaveBeenCalledTimes(2);
    expect(createSourceForTicket).toHaveBeenCalledWith('ticket-2');
    disconnect();
    expect(secondSource.close).toHaveBeenCalledTimes(1);
  });

  test('cancels a scheduled reconnect when the stream is disposed', async () => {
    jest.useFakeTimers();
    const source = createSource();
    const getTicket = jest.fn().mockResolvedValue('ticket-1');

    const disconnect = connectTicketedStream({ getTicket, createSource: () => source, retryDelay: 500 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    source.onerror();
    disconnect();
    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(getTicket).toHaveBeenCalledTimes(1);
  });
});
