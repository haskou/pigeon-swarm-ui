import { CallSignalDeliveryTracker } from './CallSignalDeliveryTracker';

describe('CallSignalDeliveryTracker', () => {
  it('applies a new signal before acknowledging it', async () => {
    const order: string[] = [];
    const tracker = new CallSignalDeliveryTracker();

    await tracker.receive(
      { expiresAt: 200, signalId: 'signal-1' },
      () => {
        order.push('apply');

        return Promise.resolve();
      },
      () => order.push('acknowledge'),
      100,
    );

    expect(order).toEqual(['apply', 'acknowledge']);
  });

  it('acknowledges a duplicate without applying it twice', async () => {
    const apply = jest.fn().mockResolvedValue(undefined);
    const acknowledge = jest.fn();
    const tracker = new CallSignalDeliveryTracker();
    const delivery = { expiresAt: 200, signalId: 'signal-1' };

    await tracker.receive(delivery, apply, acknowledge, 100);
    await tracker.receive(delivery, apply, acknowledge, 101);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(acknowledge).toHaveBeenCalledTimes(2);
  });

  it('does not apply or acknowledge expired signals', async () => {
    const apply = jest.fn().mockResolvedValue(undefined);
    const acknowledge = jest.fn();
    const tracker = new CallSignalDeliveryTracker();

    await tracker.receive(
      { expiresAt: 100, signalId: 'signal-1' },
      apply,
      acknowledge,
      100,
    );

    expect(apply).not.toHaveBeenCalled();
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it('does not acknowledge a signal that fails to apply', async () => {
    const acknowledge = jest.fn();
    const tracker = new CallSignalDeliveryTracker();

    await expect(
      tracker.receive(
        { expiresAt: 200, signalId: 'signal-1' },
        () => Promise.reject(new Error('invalid signal')),
        acknowledge,
        100,
      ),
    ).rejects.toThrow('invalid signal');

    expect(acknowledge).not.toHaveBeenCalled();
  });
});
