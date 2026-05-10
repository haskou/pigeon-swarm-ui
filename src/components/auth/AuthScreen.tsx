import { FormEvent, useState } from 'react';

import type { ConversationResource, Session } from '../../domain/types';

import { API_SERVER_URL } from '../../config';
import { login, register } from '../../domain/pigeonApi';
import { cx } from '../../utils/classNameHelper';
import { Field } from './Field';
import { HeroMetric } from './HeroMetric';

type AuthMode = 'login' | 'create';
type LoadState = 'idle' | 'loading' | 'error';

interface AuthScreenProps {
  onAuthenticated: (
    session: Session,
    conversations: ConversationResource[],
  ) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [identityId, setIdentityId] = useState('');
  const [name, setName] = useState('');
  const [networks, setNetworks] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    mode === 'login'
      ? identityId.trim().length > 0 && password.length > 0
      : name.trim().length > 0 && password.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);

    try {
      const result =
        mode === 'login'
          ? await login(identityId, password)
          : await register(
              name,
              password,
              networks
                .split(',')
                .map((network) => network.trim())
                .filter(Boolean),
            );

      onAuthenticated(result.session, result.conversations);
    } catch (caught) {
      setState('error');
      setError(
        caught instanceof Error
          ? caught.message
          : 'Error desconocido. Qué poético, pero inútil.',
      );

      return;
    }

    setState('idle');
  };

  return (
    <section className="relative z-10 grid min-h-screen place-items-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_480px] lg:items-center">
        <div className="hidden lg:block">
          <div className="glass-panel-strong rounded-[2.5rem] p-8">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="floaty h-28 w-28 rounded-[2rem] shadow-2xl shadow-indigo-950/40"
            />
            <h1 className="mt-8 max-w-xl text-6xl font-black tracking-[-.07em]">
              Glass client for a serverless little menace.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              Login local: se recoge la identidad por ID, se desencripta en el
              cliente con la contraseña, se baja el keychain y se cargan las
              conversaciones. O sea, lo mínimo para no convertir P2P en teatro
              corporativo.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <HeroMetric
                label="API"
                value={API_SERVER_URL.replace('http://', '')}
              />
              <HeroMetric label="Mode" value="1to1" />
              <HeroMetric label="Crypto" value="local" />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel-strong rounded-[2.5rem] p-5 sm:p-7"
        >
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="h-14 w-14 rounded-2xl border border-white/15 shadow-lg"
            />
            <div>
              <div className="text-2xl font-black tracking-tight">
                Pigeon Swarm
              </div>
              <div className="text-sm text-white/55">API: {API_SERVER_URL}</div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={cx(
                'rounded-xl px-4 py-3 text-sm font-black transition',
                mode === 'login'
                  ? 'bg-white text-slate-950'
                  : 'text-white/60 hover:text-white',
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={cx(
                'rounded-xl px-4 py-3 text-sm font-black transition',
                mode === 'create'
                  ? 'bg-white text-slate-950'
                  : 'text-white/60 hover:text-white',
              )}
            >
              Create account
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {mode === 'login' ? (
              <Field label="Identity ID">
                <input
                  value={identityId}
                  onChange={(event) => setIdentityId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="MCowBQYDK2VwAyEA..."
                  autoComplete="username"
                />
              </Field>
            ) : (
              <>
                <Field label="Profile name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="Ada"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Networks, separados por coma">
                  <input
                    value={networks}
                    onChange={(event) => setNetworks(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="uuid-public, uuid-private"
                  />
                </Field>
              </>
            )}

            <Field label="Password">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder="••••••••••••"
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
              />
            </Field>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={!canSubmit || state === 'loading'}
            className="glass-button mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === 'loading'
              ? 'Derivando llaves y llamando a la API...'
              : mode === 'login'
                ? 'Decrypt identity & enter'
                : 'Create identity'}
          </button>
        </form>
      </div>
    </section>
  );
}
