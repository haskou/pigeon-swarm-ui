import { FormEvent, useState } from 'react';

import { PigeonApiClient } from '../../domain/api/PigeonApiClient';
import { Field } from '../auth/Field';

export function NetworkCreationScreen({
  onNetworkCreated,
}: {
  onNetworkCreated: () => void;
}) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const client = new PigeonApiClient();

      if (mode === 'create') {
        // For create mode, we only need name - UUID will be generated server-side
        await client.createNetwork(name);
      } else {
        // For join mode, we need all three values: id, name, and key
        await client.joinNetwork(id, name, key);
      }

      onNetworkCreated();
    } catch (caught) {
      setLoading(false);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Error desconocido. Qué poético, pero inútil.',
      );
    }
  };

  return (
    <section className="relative z-10 grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/25 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-2xl font-black text-white">
            Network Configuration
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {mode === 'create'
              ? 'Create a new network for your node'
              : 'Join an existing network'}
          </p>
        </div>

        <div className="mt-6 flex space-x-4">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-bold ${
              mode === 'create'
                ? 'bg-cyan-400/20 text-cyan-400'
                : 'bg-black/25 text-white/60'
            }`}
          >
            Create Network
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 rounded-2xl px-4 py-2 text-sm font-bold ${
              mode === 'join'
                ? 'bg-cyan-400/20 text-cyan-400'
                : 'bg-black/25 text-white/60'
            }`}
          >
            Join Network
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mt-6 space-y-4">
            {mode === 'create' ? (
              <Field label="Network Name">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="My Network"
                  autoComplete="name"
                  required
                />
              </Field>
            ) : (
              <>
                <Field label="Network ID">
                  <input
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="Network UUID"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field label="Network Name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="Network Name"
                    autoComplete="off"
                    required
                  />
                </Field>
                <Field label="Network Key">
                  <input
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="Network Key"
                    autoComplete="off"
                    required
                  />
                </Field>
              </>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="glass-button mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading
              ? 'Processing...'
              : mode === 'create'
                ? 'Create Network'
                : 'Join Network'}
          </button>
        </form>
      </div>
    </section>
  );
}
