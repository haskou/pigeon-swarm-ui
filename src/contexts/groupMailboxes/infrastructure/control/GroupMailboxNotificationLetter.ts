/** A valid, timely control letter from a notification; its signer sent it. */
export type GroupMailboxNotificationLetter = {
  conversationId: string;
  /**
   * What makes the letter distinct, taken from inside the seal: its sender,
   * conversation and type, and its request id (request), key package hash
   * (response), or index and named device (welcome).
   */
  key: string;
  /** Until when a claim on it holds before a later run may retry it (ms). */
  lease: number;
  plaintext: Uint8Array;
  sender: string;
  /** When its sender sealed it (ms since the epoch). */
  sentAt: number;
  /** Until when this device keeps its key once decided (ms since the epoch). */
  until: number;
  welcome: boolean;
};
