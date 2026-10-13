export type RemovedDeviceServices = {
  directMessages: {
    cancelOutbox(identityId: string): Promise<void>;
    forgetHistory(identityId: string): Promise<void>;
  };
  identities: {
    discardDeviceSealedRecovery(identityId: string): void;
  };
};

/**
 * Erases what this device stored for an identity once the node reports the
 * device as removed: unsent messages, stored history and pending
 * device-sealed recovery steps. The local unlock stays, so the user can still
 * pair this device again or erase it. Every step runs even when one fails.
 * Resolves false when any step failed. Never throws.
 */
export async function eraseRemovedDevice(
  identityId: string,
  services: RemovedDeviceServices,
): Promise<boolean> {
  const steps = [
    () => services.directMessages.cancelOutbox(identityId),
    () => services.directMessages.forgetHistory(identityId),
    () => {
      services.identities.discardDeviceSealedRecovery(identityId);
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

  return erased;
}
