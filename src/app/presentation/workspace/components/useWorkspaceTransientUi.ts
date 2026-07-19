import { useCallback, useReducer } from 'react';

export type WorkspaceTransientSurface =
  | 'community-creation'
  | 'community-members'
  | 'conversation-creation'
  | 'inspector'
  | 'node-settings'
  | 'notifications'
  | 'realtime-events'
  | 'sidebar';

type WorkspaceTransientUiState = Readonly<
  Record<WorkspaceTransientSurface, boolean>
>;

type WorkspaceTransientUiAction =
  | { surface: WorkspaceTransientSurface; type: 'close' | 'open' }
  | { type: 'close-all' };

const closedWorkspaceTransientUi: WorkspaceTransientUiState = {
  'community-creation': false,
  'community-members': false,
  'conversation-creation': false,
  inspector: false,
  'node-settings': false,
  notifications: false,
  'realtime-events': false,
  sidebar: false,
};

export function reduceWorkspaceTransientUi(
  state: WorkspaceTransientUiState,
  action: WorkspaceTransientUiAction,
): WorkspaceTransientUiState {
  if (action.type === 'close-all') return closedWorkspaceTransientUi;

  return {
    ...state,
    [action.surface]: action.type === 'open',
  };
}

export function useWorkspaceTransientUi(): {
  close: (surface: WorkspaceTransientSurface) => void;
  closeAll: () => void;
  isOpen: (surface: WorkspaceTransientSurface) => boolean;
  open: (surface: WorkspaceTransientSurface) => void;
} {
  const [state, dispatch] = useReducer(
    reduceWorkspaceTransientUi,
    closedWorkspaceTransientUi,
  );

  const close = useCallback((surface: WorkspaceTransientSurface): void => {
    dispatch({ surface, type: 'close' });
  }, []);
  const closeAll = useCallback((): void => {
    dispatch({ type: 'close-all' });
  }, []);
  const isOpen = useCallback(
    (surface: WorkspaceTransientSurface): boolean => state[surface],
    [state],
  );
  const open = useCallback((surface: WorkspaceTransientSurface): void => {
    dispatch({ surface, type: 'open' });
  }, []);

  return { close, closeAll, isOpen, open };
}
