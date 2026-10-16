/**
 * The track a call media frame belongs to. A sealed frame is bound to it, so
 * a frame moved to another track of its sender does not open.
 */
export type CallMediaTrack =
  | 'audio'
  | 'screen-audio'
  | 'screen-video'
  | 'video';
