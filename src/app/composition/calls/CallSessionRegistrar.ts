import type { Session } from '../../../shared/domain/pigeonResources.types';

import { CallAccessContexts } from '../../../contexts/calls/infrastructure/http/CallAccessContexts';

export class CallSessionRegistrar {
  public constructor(private readonly contexts: CallAccessContexts) {}

  public register(session: Session): string {
    this.contexts.register(session);

    return session.identity.id;
  }
}
