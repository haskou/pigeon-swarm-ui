import type { CallParticipant } from '../view-models/CallParticipant';

import { shortId } from '../../../../shared/presentation/formatting';

export function callParticipantDisplayName(
  participant: CallParticipant,
): string {
  return (
    participant.identity?.profile.name?.trim() ||
    participant.name.replace(/\s*\(@[^)]*\)\s*$/, '').trim() ||
    shortId(participant.identityId)
  );
}
