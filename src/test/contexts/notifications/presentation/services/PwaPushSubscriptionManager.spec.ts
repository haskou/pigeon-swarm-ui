import { mock } from 'jest-mock-extended';

import type { PwaPushSubscriptionBackend } from '../../../../../contexts/notifications/presentation/services/PwaPushSubscriptionBackend';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

import { ApplicationServerKeyDecoder } from '../../../../../contexts/notifications/infrastructure/browser/ApplicationServerKeyDecoder';
import { PushSubscriptionCompatibility } from '../../../../../contexts/notifications/infrastructure/browser/PushSubscriptionCompatibility';
import { PwaNotificationCapability } from '../../../../../contexts/notifications/infrastructure/browser/PwaNotificationCapability';
import { PwaPushSubscriptionManager } from '../../../../../contexts/notifications/presentation/services/PwaPushSubscriptionManager';

describe(PwaPushSubscriptionManager.name, () => {
  it('does not contact the backend when push is unsupported', async () => {
    const backend = mock<PwaPushSubscriptionBackend>();
    const capability = mock<PwaNotificationCapability>();
    capability.canNotify.mockReturnValue(false);
    const manager = new PwaPushSubscriptionManager(
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
});
