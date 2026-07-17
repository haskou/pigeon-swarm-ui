import type { CallSession } from '../view-models/CallSession';

export function callSessionTitle(call: CallSession): string {
  return call.kind === 'community-voice'
    ? (call.subtitle ?? call.title)
    : call.title;
}

export function callSessionSubtitle(call: CallSession): string {
  const participantNames = call.participants
    .map((participant) => participant.name)
    .join(', ');

  if (call.kind === 'community-voice') return call.title;

  return call.subtitle || participantNames;
}
