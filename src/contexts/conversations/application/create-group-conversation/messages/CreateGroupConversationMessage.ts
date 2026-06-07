import type { CreateGroupConversationInput } from './CreateGroupConversationInput';

export type { CreateGroupConversationInput } from './CreateGroupConversationInput';
import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class CreateGroupConversationMessage {
  public constructor(
    private readonly input: {
      group: CreateGroupConversationInput;
      session: Session;
    },
  ) {}

  public getGroup(): CreateGroupConversationInput {
    return this.input.group;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
