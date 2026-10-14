import {
  clearLastLoginIdentity,
  loadLastLoginIdentity,
} from '../../contexts/identities/infrastructure/storage/lastLoginIdentity';
import { clearProjectedMessageCaches } from '../../shared/infrastructure/storage/clearProjectedMessageCaches';
import {
  communityUnreadStorageKey,
  draftsStorageKey,
  lastConversationStorageKey,
  workspaceStorageKey,
} from './workspace/components/workspacePersistence';

export type RemovedDeviceServices = {
  directMessages: {
    cancelOutbox(identityId: string): Promise<void>;
    forgetHistory(identityId: string): Promise<void>;
  };
  groupMessages: {
    forget(identityId: string): Promise<void>;
  };
  identities: {
    discardDeviceSealedRecovery(identityId: string): void;
    forgetContacts(identityId: string): Promise<void>;
    forgetDeviceUnlock(identityId: string): Promise<void>;
  };
  mls: {
    forget(identityId: string): Promise<void>;
  };
};

/**
 * Erases what this device stored for an identity once a signed, verified
 * transition proved the device was removed: unsent messages, stored direct
 * and group history, decrypted message projections, the MLS state of its
 * communities, the contact directory, pending device-sealed recovery steps,
 * drafts and workspace state, and last the vault record with the identity key
 * material and the device-sealed root, then the remembered sign-in identity
 * when it is this one. Every step runs even when one fails. The vault record
 * and the remembered identity are erased only after every other step
 * succeeded, so a partial erase leaves the identity unlockable and the next
 * unlock proves the removal again and retries. Resolves false when any step
 * failed. Never throws.
 */
export async function eraseRemovedDevice(
  identityId: string,
  services: RemovedDeviceServices,
): Promise<boolean> {
  const steps = [
    () => services.directMessages.cancelOutbox(identityId),
    () => services.directMessages.forgetHistory(identityId),
    () => services.groupMessages.forget(identityId),
    () => services.mls.forget(identityId),
    () => services.identities.forgetContacts(identityId),
    () => clearProjectedMessageCaches(),
    () => {
      services.identities.discardDeviceSealedRecovery(identityId);
    },
    () => {
      for (const key of [
        draftsStorageKey(identityId),
        lastConversationStorageKey(identityId),
        workspaceStorageKey(identityId),
        communityUnreadStorageKey(identityId),
      ]) {
        globalThis.localStorage?.removeItem(key);
      }
    },
  ];
  let erased = true;

  for (const step of steps) {
    try {
      await step();
    } catch {
      erased = false;
    }
  }

  if (!erased) return false;

  try {
    await services.identities.forgetDeviceUnlock(identityId);
  } catch {
    return false;
  }

  if (loadLastLoginIdentity() === identityId) clearLastLoginIdentity();

  return true;
}
