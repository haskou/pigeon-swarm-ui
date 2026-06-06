let glassWorkspaceModulePromise: Promise<
  typeof import('./components/GlassWorkspace')
> | null = null;

export function loadGlassWorkspaceModule(): Promise<
  typeof import('./components/GlassWorkspace')
> {
  glassWorkspaceModulePromise ??= import('./components/GlassWorkspace');

  return glassWorkspaceModulePromise;
}

export async function preloadGlassWorkspaceModule(): Promise<void> {
  await loadGlassWorkspaceModule();
}
