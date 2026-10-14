/** A valid control letter read from a notification, its signer the sender. */
export type GroupMailboxNotificationLetter = {
  conversationId: string;
  plaintext: Uint8Array;
  sender: string;
  welcome: boolean;
};
