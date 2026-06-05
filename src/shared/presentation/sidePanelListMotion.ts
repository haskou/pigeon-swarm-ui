import type { CSSProperties } from 'react';

export type SidePanelListEnterDirection = 'left' | 'right';

type SidePanelListEnterStyle = CSSProperties & {
  '--side-panel-enter-delay': string;
};

export function sidePanelListEnterClassName(
  direction: SidePanelListEnterDirection,
): string {
  return `side-panel-list-enter side-panel-list-enter-${direction}`;
}

export function sidePanelListEnterStyle(
  index: number,
): SidePanelListEnterStyle {
  return {
    '--side-panel-enter-delay': `${Math.min(index * 24, 180)}ms`,
  };
}
