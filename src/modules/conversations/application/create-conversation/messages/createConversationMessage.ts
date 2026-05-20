import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class CreateConversationMessage {
  public constructor(
    private readonly input: {
      networkId: string;
      peerIdentityId: string;
      session: Session;
    },
  ) {}

  public getNetworkId(): string {
    return this.input.networkId;
  }

  public getPeerIdentityId(): string {
    return this.input.peerIdentityId;
  }

  public getSession(): Session {
    return this.input.session;
  }
}
