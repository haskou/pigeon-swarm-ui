/** A valid control letter read from a notification, its signer the sender. */
export type GroupMailboxNotificationLetter = {
  /**
   * For a key package request or response: the id this device claims before
   * handling it, and the end of its answer window (ms since the epoch).
   */
  claim?: { id: string; until: number };
  conversationId: string;
  plaintext: Uint8Array;
  sender: string;
  welcome: boolean;
};
