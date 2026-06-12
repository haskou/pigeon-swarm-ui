import type { ReactElement } from 'react';

import { cx } from '../../../../shared/presentation/cx';

export function CommunityWorkspaceStartupFallback({
  message,
}: {
  message?: string;
}): ReactElement {
  return (
    <div
      aria-busy="true"
      className="col-span-1 grid h-full min-h-0 grid-cols-1 overflow-hidden rounded-none lg:col-span-2 lg:grid-cols-[330px_minmax(0,1fr)] xl:col-span-3 xl:grid-cols-[330px_minmax(0,1fr)_320px]"
    >
      <aside className="glass-panel-strong hidden h-full min-h-0 flex-col rounded-none p-4 lg:flex">
        <div className="h-3 w-40 rounded-full bg-white/18" />
        <div className="mt-4 overflow-hidden rounded-2xl bg-white/8">
          <div className="h-24 bg-gradient-to-br from-cyan-300/55 to-fuchsia-400/55" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-44 rounded-full bg-white/20" />
            <div className="h-3 w-56 rounded-full bg-white/12" />
            <div className="h-10 rounded-2xl bg-fuchsia-500/45" />
          </div>
        </div>
        <div className="mt-7 h-3 w-36 rounded-full bg-white/18" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={cx(
                'h-10 rounded-2xl',
                index === 0 ? 'bg-white/22' : 'bg-white/8',
              )}
            />
          ))}
        </div>
        <div className="mt-auto h-16 rounded-2xl bg-white/10" />
      </aside>

      <section className="glass-panel-strong flex h-full min-h-0 flex-col overflow-hidden rounded-none">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-300/75 to-fuchsia-400/75" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-44 rounded-full bg-white/22" />
            <div className="h-3 w-32 rounded-full bg-white/12" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 p-4">
          <div className="h-16 max-w-[70%] rounded-2xl bg-white/8" />
          <div className="ml-auto h-12 w-[68%] rounded-2xl bg-blue-500/35" />
          <div className="h-20 max-w-[76%] rounded-2xl bg-white/8" />
          {message ? (
            <div className="mx-auto rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white/55">
              {message}
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="h-14 rounded-2xl bg-black/20" />
        </div>
      </section>

      <aside className="inspector-panel hidden h-full min-h-0 flex-col gap-3 border-l border-white/10 p-4 xl:flex">
        {Array.from({ length: 3 }).map((_, index) => (
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
    </div>
  );
}
