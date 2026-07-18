export class NotificationProjectionNotFoundError extends Error {
  public constructor() {
    super('Notification projection was not registered.');
  }
}
