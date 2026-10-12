import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';

export type WorkspaceIncomingCallDialog = {
  incomingCall: {
    call: CallResource;
    caller?: CallParticipant;
    participants: CallParticipant[];
    title: string;
  } | null;
  onAccept: () => void;
  onDecline: () => void;
};
