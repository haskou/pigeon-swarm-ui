export class ConversationAccessContextNotFoundError extends Error {
  public constructor() {
    super('Conversation access context was not registered.');
    this.name = ConversationAccessContextNotFoundError.name;
  }
}
