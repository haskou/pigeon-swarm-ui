import type { CallParticipant } from '../../../../contexts/calls/presentation/view-models/CallParticipant';

export type CallStartActions = {
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
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
