import type { ReactElement, ReactNode } from 'react';

import { BackgroundGlow } from '../../shared/presentation/components/BackgroundGlow';
import { CommunityWorkspaceStartupFallback } from './workspace/components/CommunityWorkspaceStartupFallback';

interface AppFrameProps {
  children: ReactNode;
  compact?: boolean;
}

export function AppFrame({
  children,
  compact = false,
}: AppFrameProps): ReactElement {
  const layoutClass = compact
    ? 'app-compact relative flex justify-center overflow-hidden bg-[#080a25] text-white'
    : 'app-viewport relative overflow-hidden bg-[#080a25] text-white';

  return (
    <main className={layoutClass}>
      <BackgroundGlow />
      {children}
    </main>
  );
}

interface AppLoadingScreenProps {
  label: string;
}

export function AppLoadingScreen({
  label,
}: AppLoadingScreenProps): ReactElement {
  return (
    <AppFrame>
      <section className="relative z-10 min-h-full overflow-hidden overscroll-none">
        <div className="app-workspace grid w-full grid-cols-1 gap-0 px-0 pb-0 lg:grid-cols-[82px_330px_minmax(0,1fr)] xl:grid-cols-[82px_330px_minmax(0,1fr)_320px]">
          <StartupRailFallback />
          <CommunityWorkspaceStartupFallback message={label} />
        </div>
      </section>
    </AppFrame>
  );
}

function StartupRailFallback(): ReactElement {
  return (
    <aside
      aria-hidden="true"
      className="glass-panel-strong hidden h-full min-h-0 flex-col items-center gap-4 rounded-none p-4 lg:flex"
    >
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-300/75 to-fuchsia-400/75" />
      <div className="h-px w-10 bg-white/10" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-12 w-12 rounded-2xl bg-white/10"
        />
      ))}
      <div className="mt-auto space-y-3">
        <div className="h-12 w-12 rounded-2xl bg-white/10" />
        <div className="h-12 w-12 rounded-2xl bg-white/10" />
      </div>
    </aside>
  );
}
