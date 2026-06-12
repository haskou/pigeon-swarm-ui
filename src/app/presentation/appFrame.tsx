import type { ReactElement, ReactNode } from 'react';

import type { RememberedIdentityPreview } from '../../contexts/identities/infrastructure/storage/rememberedIdentityPreview';

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

interface AppLoadingScreenProps {
  identityPreview?: RememberedIdentityPreview | null;
  label: string;
}

export function AppLoadingScreen({
  identityPreview,
  label,
}: AppLoadingScreenProps): ReactElement {
  const initial = identityPreview?.name?.slice(0, 1).toUpperCase() ?? 'P';

  return (
    <AppFrame>
      <section className="relative z-10 grid min-h-full place-items-center overflow-hidden overscroll-none px-6 text-center">
        <div className="grid gap-3">
          <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300/75 to-fuchsia-400/75 text-xl font-black text-slate-950 shadow-xl shadow-black/30">
            {identityPreview?.pictureUrl ? (
              <img
                src={identityPreview.pictureUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div
            className="text-lg font-black text-white/80"
            aria-live="polite"
          >
            {label}
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
