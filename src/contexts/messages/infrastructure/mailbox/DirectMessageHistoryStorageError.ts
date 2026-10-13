/**
 * This device could not store direct-message records in its local history,
 * for example because the browser storage quota is exhausted. The sync pass
 * then leaves the page unacknowledged, so the node keeps the envelopes until a
 * later pass stores them or the node's retention expires them.
 */
export class DirectMessageHistoryStorageError extends Error {
  public constructor() {
    super('Direct history could not be stored on this device');
    this.name = DirectMessageHistoryStorageError.name;
  }
}
