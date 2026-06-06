import type { Session } from '../../../../../shared/domain/pigeonResources.types';

export class CreatePublicNetworkMessage {
  public constructor(private readonly session?: Session) {}

  public getSession(): Session | undefined {
    return this.session;
  }
}
