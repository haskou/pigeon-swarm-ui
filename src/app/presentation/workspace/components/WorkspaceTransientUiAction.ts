import type { WorkspaceTransientSurface } from './useWorkspaceTransientUi';

export type WorkspaceTransientUiAction =
  | { surface: WorkspaceTransientSurface; type: 'close' | 'open' }
  | { type: 'close-all' };
