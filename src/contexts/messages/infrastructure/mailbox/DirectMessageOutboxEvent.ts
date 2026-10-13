/**
 * What changed. `delivered` names the send that left the queue, so a view can
 * drop its pending state. `changed` is any other state change.
 */
export type DirectMessageOutboxEvent =
  | { kind: 'changed' }
  | { conversationId: string; id: string; kind: 'delivered' };
