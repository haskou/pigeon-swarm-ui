import { FormEvent, useEffect, useState } from 'react';

import type { ConversationResource, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { API_SERVER_URL } from '../../config';
import { copy } from '../../i18n/en';
import {
  clearSavedCredentials,
  loadSavedCredentials,
  saveCredentials,
} from '../../presentation/auth/savedCredentials';
import { useNodeNetworks } from '../../presentation/hooks/useNodeNetworks';
import { GlassSelect } from '../common/GlassSelect';
import { SegmentedControl } from '../common/SegmentedControl';
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
  const [rememberMe, setRememberMe] = useState(false);
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const { networks: availableNetworks } = useNodeNetworks();
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const modeOptions = [
    { label: copy.auth.login, value: 'login' },
    { label: copy.auth.createIdentity, value: 'create' },
  ] satisfies Array<{ label: string; value: AuthMode }>;

  useEffect(() => {
    if (availableNetworks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(availableNetworks[0].id);
    }
  }, [availableNetworks, selectedNetwork]);

  useEffect(() => {
    const savedCredentials = loadSavedCredentials();

    if (savedCredentials) {
      setIdentityId(savedCredentials.identityId);
      setPassword(savedCredentials.password);
      setRememberMe(true);
    }
  }, []);

  const canSubmit =
    mode === 'login'
      ? identityId.trim().length > 0 && password.length > 0
      : name.trim().length > 0 &&
        password.length > 0 &&
        (availableNetworks.length === 0 || selectedNetwork !== '');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSubmit) return;

    setState('loading');
    setError(null);

    try {
      let networksToRegister: string[] = [];

      if (mode === 'create') {
        // For registration, use selected network or default to empty array
        if (selectedNetwork) {
          networksToRegister = [selectedNetwork];
        } else if (availableNetworks.length === 0 && networks) {
          // Fallback to comma-separated input if no networks available
          networksToRegister = networks
            .split(',')
            .map((network) => network.trim())
            .filter(Boolean);
        } else if (availableNetworks.length === 0) {
          // If no networks available and no comma-separated input, register with empty array
          networksToRegister = [];
        }
      }

      const result =
        mode === 'login'
          ? await pigeonApplication.login(identityId, password)
          : await pigeonApplication.register(
              name,
              password,
              networksToRegister,
            );

      if (rememberMe) {
        saveCredentials({
          identityId: result.session.identity.id,
          password,
        });
      } else {
        clearSavedCredentials();
      }

      onAuthenticated(result.session, result.conversations);
    } catch (caught) {
      setState('error');
      setError(
        caught instanceof Error ? caught.message : copy.auth.unknownError,
      );

      return;
    }

    setState('idle');
  };

  return (
    <section className="relative z-10 grid min-h-screen place-items-stretch p-0 sm:place-items-center sm:px-4 sm:py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_480px] lg:items-center">
        <div className="hidden lg:block">
          <div className="glass-panel-strong rounded-[2.5rem] p-8">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="floaty h-28 w-28 rounded-[2rem] shadow-2xl shadow-indigo-950/40"
            />
            <h1 className="mt-8 max-w-xl text-6xl font-black tracking-[-.07em]">
              {copy.auth.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              {copy.auth.heroBody}
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <HeroMetric
                label={copy.auth.apiLabel}
                value={API_SERVER_URL.replace('http://', '')}
              />
              <HeroMetric
                label={copy.auth.networksLabel}
                value={`${availableNetworks.length}`}
              />
              <HeroMetric
                label={copy.auth.peersLabel}
                value={copy.auth.peersPlaceholder}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel-strong min-h-screen rounded-none p-5 sm:min-h-0 sm:rounded-[2.5rem] sm:p-7"
        >
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={modeOptions}
          />

          <div className="mt-6 space-y-4">
            {mode === 'login' ? (
              <Field label={copy.auth.identityIdLabel}>
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
                <Field label={copy.auth.profileNameLabel}>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                    placeholder="Ada"
                    autoComplete="name"
                  />
                </Field>
                {availableNetworks.length > 0 ? (
                  <Field label={copy.auth.networkLabel}>
                    <GlassSelect
                      ariaLabel={copy.auth.networkLabel}
                      value={selectedNetwork}
                      onChange={setSelectedNetwork}
                      options={availableNetworks.map((network) => ({
                        label: network.name,
                        value: network.id,
                      }))}
                    />
                  </Field>
                ) : (
                  <Field label={copy.auth.fallbackNetworksLabel}>
                    <input
                      value={networks}
                      onChange={(event) => setNetworks(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                      placeholder="uuid-public, uuid-private"
                    />
                  </Field>
                )}
              </>
            )}

            <Field label={copy.auth.passwordLabel}>
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

          <div className="mt-6 flex items-center">
            <div
              onClick={() => setRememberMe(!rememberMe)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full border border-white/10 transition-colors focus:outline-none ${
                rememberMe ? 'bg-cyan-400/20' : 'bg-black/25'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  rememberMe ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </div>
            <label
              htmlFor="remember-me"
              className="ml-2 block text-sm text-white/60"
            >
              {copy.auth.rememberMe}
            </label>
          </div>

          <button
            disabled={!canSubmit || state === 'loading'}
            className="glass-button mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === 'loading'
              ? copy.auth.loadingSubmit
              : mode === 'login'
                ? copy.auth.loginSubmit
                : copy.auth.createIdentity}
          </button>
        </form>
      </div>
    </section>
  );
}
