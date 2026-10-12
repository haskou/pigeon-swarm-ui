import { type PointerEvent, useRef } from 'react';

import type { SidebarGestureHandlers } from './SidebarGestureHandlers';

type SidebarGesture = {
  pointerId: number;
  startX: number;
  startY: number;
};

export function useSidebarGesture(
  sidebarOpen: boolean,
  openSidebar: () => void,
): SidebarGestureHandlers {
  const sidebarGestureRef = useRef<SidebarGesture | null>(null);

  const handleWorkspacePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' || sidebarOpen) return;

    if (event.clientX > 28) return;

    sidebarGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handleWorkspacePointerMove = (event: PointerEvent<HTMLElement>) => {
    const gesture = sidebarGestureRef.current;

    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = Math.abs(event.clientY - gesture.startY);

    if (deltaX > 54 && deltaY < 42) {
      openSidebar();
      sidebarGestureRef.current = null;
    }

    if (deltaX < -16 || deltaY > 72) {
      sidebarGestureRef.current = null;
    }
  };

  const clearSidebarGesture = (event: PointerEvent<HTMLElement>) => {
    if (sidebarGestureRef.current?.pointerId === event.pointerId) {
      sidebarGestureRef.current = null;
    }
  };

  return {
    clearSidebarGesture,
    handleWorkspacePointerDown,
    handleWorkspacePointerMove,
  };
}
