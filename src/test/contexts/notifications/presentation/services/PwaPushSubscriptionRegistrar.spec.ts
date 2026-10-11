import { mock } from 'jest-mock-extended';

import type { PwaPushSubscriptionBackend } from '../../../../../contexts/notifications/presentation/services/PwaPushSubscriptionBackend';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { ApplicationServerKeyDecoder } from '../../../../../contexts/notifications/infrastructure/browser/ApplicationServerKeyDecoder';
import { PushSubscriptionCompatibility } from '../../../../../contexts/notifications/infrastructure/browser/PushSubscriptionCompatibility';
import { PwaNotificationCapability } from '../../../../../contexts/notifications/infrastructure/browser/PwaNotificationCapability';
import { PwaPushSubscriptionRegistrar } from '../../../../../contexts/notifications/presentation/services/PwaPushSubscriptionRegistrar';

describe(PwaPushSubscriptionRegistrar.name, () => {
  it('does not contact the backend when push is unsupported', async () => {
    const backend = mock<PwaPushSubscriptionBackend>();
    const capability = mock<PwaNotificationCapability>();
    capability.canNotify.mockReturnValue(false);
    const manager = new PwaPushSubscriptionRegistrar(
      backend,
      capability,
      new ApplicationServerKeyDecoder(),
      new PushSubscriptionCompatibility(),
    );
    const session = {
      identity: { id: 'identity-1' },
    } as unknown as Session;

    await expect(manager.ensure(session)).resolves.toBe('unsupported');
    expect(backend.findServer).not.toHaveBeenCalled();
  });

  it('removes the browser subscription even when the backend delete fails', async () => {
    const backend = mock<PwaPushSubscriptionBackend>();
    backend.delete.mockRejectedValue(new Error('offline'));
    const capability = mock<PwaNotificationCapability>();
    capability.canNotify.mockReturnValue(true);
    const unsubscribe = jest.fn().mockResolvedValue(true);
    const getSubscription = jest.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: {} }),
      unsubscribe,
    });
    const originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    );

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          ready: Promise.resolve({ pushManager: { getSubscription } }),
        },
      },
    });

    try {
      const manager = new PwaPushSubscriptionRegistrar(
        backend,
        capability,
        new ApplicationServerKeyDecoder(),
        new PushSubscriptionCompatibility(),
      );
      const session = {
        identity: { id: 'identity-1' },
      } as unknown as Session;

      await expect(manager.delete(session)).rejects.toThrow('offline');
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        Reflect.deleteProperty(globalThis, 'navigator');
      }
    }
  });
});
