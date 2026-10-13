/** Sends a control record of a conversation to one peer, signed and sealed. */
export interface GroupMailboxDirectLink {
  send(
    conversationId: string,
    peerIdentityId: string,
    plaintext: Uint8Array,
  ): Promise<void>;
}
