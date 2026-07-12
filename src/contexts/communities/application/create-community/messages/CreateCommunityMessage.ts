import type { Session } from '../../../../../shared/domain/pigeonResources.types';
import type { CreateCommunityInput } from '../CreateCommunityInput';

export class CreateCommunityMessage {
  public constructor(
    private readonly session: Session,
    private readonly input: CreateCommunityInput,
  ) {}

  public getInput(): CreateCommunityInput {
    return this.input;
  }

  public getSession(): Session {
    return this.session;
  }
}
