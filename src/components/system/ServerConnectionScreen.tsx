import { API_SERVER_URL } from '../../config';
import { copy } from '../../i18n/en';

interface ServerConnectionScreenProps {
  error: Error | null;
  onRetry: () => void;
}

export function ServerConnectionScreen({
  error,
  onRetry,
}: ServerConnectionScreenProps) {
  return (
    <section className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-6 sm:py-8">
      <div className="glass-panel-strong flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl p-6 text-center sm:p-8">
        <img
          src="/connectionLost.png"
          alt={copy.connection.imageAlt}
          className="mx-auto mb-6 aspect-[16/10] w-full max-w-md"
        />

        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          {copy.connection.kicker}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/65">
          {copy.connection.body}
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-left">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/40">
            {copy.connection.endpointLabel}
          </div>
          <div className="mt-2 break-all text-sm font-bold text-white">
            {API_SERVER_URL}
          </div>
          {error && (
            <div className="mt-3 text-sm text-rose-100/80">{error.message}</div>
          )}
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="glass-button mt-6 rounded-2xl bg-fuchsia-500 px-6 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:scale-[1.01]"
        >
          {copy.connection.retry}
        </button>
      </div>
    </section>
  );
}
