import type { WorkspaceTransientSurface } from './useWorkspaceTransientUi';

export type WorkspaceTransientUiState = Readonly<
  Record<WorkspaceTransientSurface, boolean>
>;
