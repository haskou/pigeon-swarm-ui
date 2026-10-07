import type { Session } from '../../../../shared/domain/pigeonResources.types';

/** Facts about a call scope that the signed call start must commit to. */
export interface CallScopeLookup {
  communityNetworkId(session: Session, communityId: string): Promise<string>;
  conversation(
    session: Session,
    conversationId: string,
  ): Promise<{ networkId: string; participantIds: string[] }>;
}
