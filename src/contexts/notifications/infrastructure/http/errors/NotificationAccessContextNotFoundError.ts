export class NotificationAccessContextNotFoundError extends Error {
  public constructor() {
    super('Notification access context was not registered.');
  }
}
