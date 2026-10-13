/** Sends a plaintext sealed in the 1:1 mailbox shared with a peer. */
export interface GroupMailboxDirectLink {
  send(peerIdentityId: string, plaintext: Uint8Array): Promise<void>;
}
