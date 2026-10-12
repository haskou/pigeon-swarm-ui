import type { PointerEvent } from 'react';

export interface SidebarGestureHandlers {
  clearSidebarGesture: (event: PointerEvent<HTMLElement>) => void;
  handleWorkspacePointerDown: (event: PointerEvent<HTMLElement>) => void;
  handleWorkspacePointerMove: (event: PointerEvent<HTMLElement>) => void;
}
