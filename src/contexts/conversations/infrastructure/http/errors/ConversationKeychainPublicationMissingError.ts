export class ConversationKeychainPublicationMissingError extends Error {
  public constructor() {
    super('Conversation keychain publication did not return an identifier.');
    this.name = ConversationKeychainPublicationMissingError.name;
  }
}
