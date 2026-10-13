/** One decrypted stored direct-history record and its conversation. */
export interface DirectMessageHistoryItem {
  conversationId: string;
  plaintext: Uint8Array;
}
