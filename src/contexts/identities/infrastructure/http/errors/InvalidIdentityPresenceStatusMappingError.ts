export class InvalidIdentityPresenceStatusMappingError extends Error {
  public constructor(status: string) {
    super(`Cannot map identity presence status: ${status}.`);
  }
}
