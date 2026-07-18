import type { Session } from '../../../../shared/domain/pigeonResources.types';
import type { ApplicationServerKey } from '../../infrastructure/browser/ApplicationServerKey';
import type { EnsurePwaPushSubscriptionOptions } from '../../infrastructure/browser/EnsurePwaPushSubscriptionOptions';
import type { EnsurePwaPushSubscriptionResult } from '../../infrastructure/browser/EnsurePwaPushSubscriptionResult';
import type { OptionalApplicationServerKey } from '../../infrastructure/browser/OptionalApplicationServerKey';
import type { Permission } from '../../infrastructure/browser/Permission';
import type { PwaPushSubscriptionBackend } from './PwaPushSubscriptionBackend';

import { ApplicationServerKeyDecoder } from '../../infrastructure/browser/ApplicationServerKeyDecoder';
import { PushSubscriptionsUnsupportedError } from '../../infrastructure/browser/errors/PushSubscriptionsUnsupportedError';
import { PushSubscriptionCompatibility } from '../../infrastructure/browser/PushSubscriptionCompatibility';
import { PwaNotificationCapability } from '../../infrastructure/browser/PwaNotificationCapability';

export class PwaPushSubscriptionRegistrar {
  private readonly explicitSubscriptions = new Map<
    string,
    Promise<EnsurePwaPushSubscriptionResult>
  >();

  public constructor(
    private readonly backend: PwaPushSubscriptionBackend,
    private readonly capability: PwaNotificationCapability,
    private readonly keyDecoder: ApplicationServerKeyDecoder,
    private readonly compatibility: PushSubscriptionCompatibility,
  ) {}

  private async currentPermission(
    options: EnsurePwaPushSubscriptionOptions,
  ): Promise<Permission> {
    return options.requestPermission
      ? await this.capability.requestPermission()
      : Notification.permission;
  }

  private async enabledServerKey(): Promise<OptionalApplicationServerKey> {
    const server = await this.backend.findServer();

    if (!server.enabled || !server.publicKey) return null;

    return this.keyDecoder.decode(server.publicKey);
  }

  private async replaceBrowserSubscription(
    session: Session,
    subscription: PushSubscription,
  ): Promise<void> {
    const subscriptionJson = subscription.toJSON();

    if (this.compatibility.isDeliverable(subscriptionJson)) {
      try {
        await this.backend.delete(session, subscriptionJson);
      } catch {
        // The browser subscription must still be replaced locally.
      }
    }

    await subscription.unsubscribe();
  }

  private async subscriptionFor(
    session: Session,
    registration: ServiceWorkerRegistration,
    applicationServerKey: ApplicationServerKey,
  ): Promise<PushSubscription> {
    if (!registration.pushManager) {
      throw new PushSubscriptionsUnsupportedError();
    }

    const existing = await registration.pushManager.getSubscription();

    if (!existing) {
      return await registration.pushManager.subscribe({
        applicationServerKey,
        userVisibleOnly: true,
      });
    }

    if (this.compatibility.canReuse(existing, applicationServerKey)) {
      return existing;
    }

    await this.replaceBrowserSubscription(session, existing);

    return await registration.pushManager.subscribe({
      applicationServerKey,
      userVisibleOnly: true,
    });
  }

  private async ensureOnce(
    session: Session,
    options: EnsurePwaPushSubscriptionOptions,
  ): Promise<EnsurePwaPushSubscriptionResult> {
    if (!this.capability.canNotify()) return 'unsupported';

    if ((await this.currentPermission(options)) !== 'granted') {
      return 'permission_denied';
    }

    const applicationServerKey = await this.enabledServerKey();

    if (!applicationServerKey) return 'server_disabled';

    const registration = await navigator.serviceWorker.ready;
    let subscription: PushSubscription;

    try {
      subscription = await this.subscriptionFor(
        session,
        registration,
        applicationServerKey,
      );
    } catch (caught) {
      if (caught instanceof PushSubscriptionsUnsupportedError) {
        return 'unsupported';
      }

      throw caught;
    }

    await this.backend.register(session, subscription.toJSON());

    return 'granted';
  }

  public async delete(session: Session): Promise<void> {
    if (!this.capability.canNotify()) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return;

    await this.backend.delete(session, subscription.toJSON());
    await subscription.unsubscribe();
  }

  public async ensure(
    session: Session,
    options: EnsurePwaPushSubscriptionOptions = {},
  ): Promise<EnsurePwaPushSubscriptionResult> {
    if (!options.requestPermission) {
      return await this.ensureOnce(session, options);
    }

    const pending = this.explicitSubscriptions.get(session.identity.id);

    if (pending) return await pending;

    const subscription = this.ensureOnce(session, options).finally(() => {
      this.explicitSubscriptions.delete(session.identity.id);
    });

    this.explicitSubscriptions.set(session.identity.id, subscription);

    return await subscription;
  }
}
