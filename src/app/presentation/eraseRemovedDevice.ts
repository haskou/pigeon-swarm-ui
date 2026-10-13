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
 * Erases what this device stored for an identity when the user asks to start
 * over after the node reported the device as removed: unsent messages, stored
 * history and pending device-sealed recovery steps. The node's report is not
 * signed, so it never triggers this by itself. The local unlock stays for the
 * caller to remove. Every step runs even when one fails. Resolves false when
 * any step failed. Never throws.
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
