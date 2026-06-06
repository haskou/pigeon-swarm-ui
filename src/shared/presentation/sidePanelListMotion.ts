import type { CSSProperties } from 'react';

export type SidePanelListEnterDirection = 'left' | 'right';

type SidePanelListEnterStyle = CSSProperties & {
  '--side-panel-enter-delay': string;
};

export function sidePanelListEnterClassName(
  direction: SidePanelListEnterDirection,
  enabled = true,
): string {
  if (!enabled) return '';

  return `side-panel-list-enter side-panel-list-enter-${direction}`;
}

export function sidePanelListEnterStyle(
  index: number,
  enabled = true,
): SidePanelListEnterStyle {
  return {
    '--side-panel-enter-delay': enabled
      ? `${Math.min(index * 32, 220)}ms`
      : '0ms',
  };
}
