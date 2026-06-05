import type { CSSProperties } from 'react';

export type MessageTimelineEnterDirection = 'incoming' | 'neutral' | 'outgoing';

type MessageTimelineEnterStyle = CSSProperties & {
  '--message-enter-delay': string;
};

export function messageTimelineEnterClassName(
  direction: MessageTimelineEnterDirection,
): string {
  return `message-timeline-enter message-timeline-enter-${direction}`;
}

export function messageTimelineEnterStyle(
  indexFromBottom: number,
): MessageTimelineEnterStyle {
  return {
    '--message-enter-delay': `${Math.min(indexFromBottom * 22, 220)}ms`,
  };
}
