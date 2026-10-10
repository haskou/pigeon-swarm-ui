import type { ReactElement, ReactNode } from 'react';

import { BackgroundGlow } from '../../shared/presentation/components/BackgroundGlow';

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
