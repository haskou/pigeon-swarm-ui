export interface DirectMessageHistoryRow {
  conversationId: string;
  identityId: string;
  recordId: string;
  sealed: Uint8Array<ArrayBuffer>;
}
