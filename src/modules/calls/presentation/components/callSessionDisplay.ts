import type { CallSession } from '../../domain/callSession.types';

export function callSessionTitle(call: CallSession): string {
  if (call.kind === 'community-voice' && call.subtitle) {
    return `${call.subtitle} · ${call.title}`;
  }

  return call.title;
}

export function callSessionSubtitle(call: CallSession): string {
  const participantNames = call.participants
    .map((participant) => participant.name)
    .join(', ');

  if (call.kind === 'community-voice') return participantNames;

  return call.subtitle || participantNames;
}
