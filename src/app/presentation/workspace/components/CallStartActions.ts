import type { CallResource } from '../../../../contexts/calls/infrastructure/http/resources/CallResource';
import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';

export type CallStartActions = {
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
  followSupersededCall: (call: CallResource) => void;
  isCallActionInProgress: () => boolean;
  startCommunityVoiceCall: (channel: {
    connectedIdentityIds?: string[];
    id: string;
    name: string;
  }) => void;
  startConversationCall: (input: {
    conversationId: string;
    kind: 'group' | 'one-to-one';
    participants: CallParticipant[];
    title: string;
  }) => void;
};
