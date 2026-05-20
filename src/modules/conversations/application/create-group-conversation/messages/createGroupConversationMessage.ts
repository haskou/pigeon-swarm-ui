import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export type CreateGroupConversationInput = {
  name: string;
  networkId: string;
  participantIds: string[];
};

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
