import { CallSignalDeliveryTracker } from '../../../../../contexts/calls/infrastructure/realtime/CallSignalDeliveryTracker';

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

  it('reserves a signal while its first delivery is still being applied', async () => {
    let finishApplying: (() => void) | undefined;
    const apply = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishApplying = resolve;
        }),
    );
    const acknowledge = jest.fn();
    const tracker = new CallSignalDeliveryTracker();
    const delivery = { expiresAt: 200, signalId: 'signal-1' };

    const first = tracker.receive(delivery, apply, acknowledge, 100);
    const duplicate = tracker.receive(delivery, apply, acknowledge, 101);

    expect(apply).toHaveBeenCalledTimes(1);
    expect(acknowledge).not.toHaveBeenCalled();

    finishApplying?.();
    await Promise.all([first, duplicate]);

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

  it('allows retrying a signal after application fails', async () => {
    const apply = jest
      .fn()
      .mockRejectedValueOnce(new Error('invalid signal'))
      .mockResolvedValueOnce(undefined);
    const acknowledge = jest.fn();
    const tracker = new CallSignalDeliveryTracker();
    const delivery = { expiresAt: 200, signalId: 'signal-1' };

    await expect(
      tracker.receive(delivery, apply, acknowledge, 100),
    ).rejects.toThrow('invalid signal');
    await tracker.receive(delivery, apply, acknowledge, 101);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });
});
