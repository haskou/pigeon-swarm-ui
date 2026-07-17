export class DisconnectedIdentityPresenceMappingError extends Error {
  public constructor() {
    super('Disconnected presence cannot be sent as a selected status.');
  }
}
