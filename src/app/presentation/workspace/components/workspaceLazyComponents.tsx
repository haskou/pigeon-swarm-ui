import { type ReactElement, lazy } from 'react';

let inspectorModulePromise: Promise<typeof import('./Inspector')> | null = null;
let sidebarModulePromise: Promise<typeof import('./Sidebar')> | null = null;
let communityWorkspaceModulePromise: Promise<
  typeof import('../../../../contexts/communities/presentation/components/CommunityWorkspace')
> | null = null;

function loadInspectorModule(): Promise<typeof import('./Inspector')> {
  inspectorModulePromise ??= import('./Inspector');

  return inspectorModulePromise;
}

function loadSidebarModule(): Promise<typeof import('./Sidebar')> {
  sidebarModulePromise ??= import('./Sidebar');

  return sidebarModulePromise;
}

function loadCommunityWorkspaceModule(): Promise<
  typeof import('../../../../contexts/communities/presentation/components/CommunityWorkspace')
> {
  communityWorkspaceModulePromise ??= import(
    '../../../../contexts/communities/presentation/components/CommunityWorkspace'
  );

  return communityWorkspaceModulePromise;
}

export function preloadCommunityWorkspace(): Promise<
  typeof import('../../../../contexts/communities/presentation/components/CommunityWorkspace')
> {
  return loadCommunityWorkspaceModule();
}

void loadInspectorModule();
void loadSidebarModule();

export const Inspector = lazy(() =>
  loadInspectorModule().then((module) => ({
    default: module.Inspector,
  })),
);

export const Sidebar = lazy(() =>
  loadSidebarModule().then((module) => ({
    default: module.Sidebar,
  })),
);

export const WorkspaceDialogs = lazy(() =>
  import('./WorkspaceDialogs').then((module) => ({
    default: module.WorkspaceDialogs,
  })),
);

export const CommunityWorkspace = lazy(() =>
  loadCommunityWorkspaceModule().then((module) => ({
    default: module.CommunityWorkspace,
  })),
);

export function SidebarStartupFallback(): ReactElement {
  return (
    <aside
      aria-hidden="true"
      className="glass-panel-strong flex h-full min-h-0 flex-col rounded-none p-4"
    >
      <div className="h-12 rounded-2xl bg-fuchsia-500/70 shadow-xl shadow-fuchsia-950/20" />
      <div className="mt-5 h-3 w-40 rounded-full bg-white/18" />
      <div className="mt-4 h-11 rounded-2xl bg-black/18" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl bg-white/8 p-3"
          >
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-300/75 to-fuchsia-400/75" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-28 rounded-full bg-white/20" />
              <div className="h-3 w-20 rounded-full bg-white/12" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/10 p-3">
        <div className="h-12 w-12 rounded-2xl bg-white/18" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-24 rounded-full bg-white/20" />
          <div className="h-3 w-16 rounded-full bg-white/12" />
        </div>
      </div>
    </aside>
  );
}

export function InspectorStartupFallback(): ReactElement {
  return (
    <aside
      aria-hidden="true"
      className="inspector-panel hidden h-full min-h-0 flex-col gap-3 border-l border-white/10 p-4 xl:flex"
    >
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-[#4d4f62] p-3"
        >
          <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-300/70 to-fuchsia-400/70" />
          <div className="relative min-w-0 flex-1 space-y-2">
            <div className="h-4 w-24 rounded-full bg-[#747687]" />
            <div className="h-3 w-16 rounded-full bg-[#666879]" />
          </div>
        </div>
      ))}
    </aside>
  );
}
