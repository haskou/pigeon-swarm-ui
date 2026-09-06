import { lazy, Suspense, useEffect, useState } from 'react';

import { retireClientNodeNotifications } from '../../../shared/infrastructure/client/retireClientNodeNotifications';
import { ClientCompatibilityProbe } from '../../../shared/infrastructure/client/ClientCompatibilityProbe';
import { ClientConnectionError } from '../../../shared/infrastructure/client/ClientConnectionError';
import { ClientNodeEndpoint } from '../../../shared/infrastructure/client/ClientNodeEndpoint';
import { ClientNodeSelection } from '../../../shared/infrastructure/client/ClientNodeSelection';
import { clientNodeForDocument } from '../../../shared/infrastructure/client/clientNodeForDocument';

const App = lazy(() => import('../../app'));
const copy = navigator.language.toLowerCase().startsWith('es')
  ? {
      title: 'Conectar a un nodo',
      notifications:
        'No se pudieron desconectar las notificaciones del nodo anterior. Vuelve a intentarlo antes de cambiar de nodo.',
      explanation:
        'Elige el nodo que gestionará tus datos. El código de esta aplicación procede del distribuidor del cliente, no de ese nodo.',
      label: 'Dirección del nodo',
      connect: 'Conectar',
      checking: 'Comprobando compatibilidad…',
      change: 'Cambiar de nodo',
      incompatible: 'Este nodo no es compatible con esta versión del cliente.',
      unreachable:
        'No se pudo conectar de forma segura. Comprueba la dirección, el certificado y que el nodo permita conexiones desde este cliente.',
      invalid:
        'Introduce una dirección HTTPS sin usuario, contraseña, parámetros ni fragmentos. HTTP solo está permitido en localhost.',
      storage:
        'No se pudo guardar el nodo. Permite el almacenamiento local para continuar.',
    }
  : {
      title: 'Connect to a node',
      notifications:
        'Could not disconnect notifications from the previous node. Retry before switching nodes.',
      explanation:
        'Choose the node that will handle your data. This application’s code comes from the client distributor, not from that node.',
      label: 'Node address',
      connect: 'Connect',
      checking: 'Checking compatibility…',
      change: 'Change node',
      incompatible: 'This node is not compatible with this client version.',
      unreachable:
        'Could not connect securely. Check the address, certificate and whether the node allows connections from this client.',
      invalid:
        'Enter an HTTPS address without credentials, query parameters or fragments. HTTP is only allowed on localhost.',
      storage: 'Could not save the node. Allow local storage to continue.',
    };

export function IndependentClient() {
  const selected = clientNodeForDocument();
  const choosing = window.location.pathname === '/connect';
  const [endpoint, setEndpoint] = useState(selected?.url ?? '');
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(Boolean(selected && !choosing));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected || choosing) return;
    const controller = new AbortController();

    void new ClientCompatibilityProbe()
      .verify(selected.url, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setReady(true);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof ClientConnectionError
              ? copy[failure.code]
              : copy.unreachable,
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });

    return () => controller.abort();
  }, [selected, choosing]);

  async function connect(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError('');
    let url: string;

    try {
      url = ClientNodeEndpoint.normalize(endpoint);
    } catch {
      setError(copy.invalid);
      return;
    }
    setChecking(true);
    try {
      await new ClientCompatibilityProbe().verify(url);
    } catch (failure) {
      setError(
        failure instanceof ClientConnectionError
          ? copy[failure.code]
          : copy.unreachable,
      );
      setChecking(false);
      return;
    }
    if (!selected || selected.url !== url) {
      try {
        await retireClientNodeNotifications();
      } catch {
        setError(copy.notifications);
        setChecking(false);
        return;
      }
    }
    try {
      await new ClientNodeSelection(window.localStorage).save(url);
      window.location.assign('/' + window.location.hash);
    } catch {
      setError(copy.storage);
      setChecking(false);
    }
  }

  if (ready)
    return (
      <>
        <a
          className="fixed right-2 bottom-2 z-[100] rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-xs text-white shadow-lg"
          href="/connect"
        >
          {copy.change}
        </a>
        <Suspense fallback={<p role="status">{copy.checking}</p>}>
          <App />
        </Suspense>
      </>
    );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-5 text-slate-100">
      <form
        onSubmit={(event) => {
          void connect(event);
        }}
        className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-xl"
      >
        <img src="/logo.png" alt="Pigeon Swarm" className="h-14 w-14" />
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-slate-300">{copy.explanation}</p>
        <label className="block space-y-2">
          <span>{copy.label}</span>
          <input
            type="url"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="https://node.example.org/api"
            required
            disabled={checking}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-white"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={checking}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {checking ? copy.checking : copy.connect}
        </button>
      </form>
    </main>
  );
}
