import { lazy, Suspense, useEffect, useState } from 'react';

import { ClientCompatibilityProbe } from '../../../shared/infrastructure/client/ClientCompatibilityProbe';
import { ClientConnectionError } from '../../../shared/infrastructure/client/ClientConnectionError';
import { ClientNodeEndpoint } from '../../../shared/infrastructure/client/ClientNodeEndpoint';
import {
  forgetRegistrationLink,
  pendingRegistrationLink,
} from '../../../contexts/nodeAccess/presentation/view-models/registrationLink';
import {
  clientNodeForDocument,
  selectClientNodeForDocument,
} from '../../../shared/infrastructure/client/clientNodeForDocument';
import { ClientNodeSelection } from '../../../shared/infrastructure/client/ClientNodeSelection';
import { retireClientNodeNotifications } from '../../../shared/infrastructure/client/retireClientNodeNotifications';

const App = lazy(() => import('../../app'));
const copy = navigator.language.toLowerCase().startsWith('es')
  ? {
      change: 'Cambiar de nodo',
      checking: 'Comprobando compatibilidad…',
      connect: 'Conectar',
      explanation:
        'Elige el nodo que gestionará tus datos. El código de esta aplicación procede del distribuidor del cliente, no de ese nodo.',
      incompatible: 'Este nodo no es compatible con esta versión del cliente.',
      invalid:
        'Introduce una dirección HTTPS sin usuario, contraseña, parámetros ni fragmentos. HTTP solo está permitido en localhost.',
      label: 'Dirección del nodo',
      notifications:
        'No se pudieron desconectar las notificaciones del nodo anterior. Vuelve a intentarlo antes de cambiar de nodo.',
      registrationSwitchBody:
        'Este enlace de registro es para {node}. Este navegador está conectado a {current}. Tus identidades en el nodo actual se quedan allí; puedes volver con «Cambiar de nodo».',
      registrationSwitchConfirm: 'Cambiar de nodo y registrarme',
      registrationSwitchKeep: 'Seguir en el nodo actual',
      registrationSwitchTitle: '¿Registrarte en otro nodo?',
      storage:
        'No se pudo guardar el nodo. Permite el almacenamiento local para continuar.',
      title: 'Conectar a un nodo',
      unreachable:
        'No se pudo conectar de forma segura. Comprueba la dirección, el certificado y que el nodo permita conexiones desde este cliente.',
    }
  : {
      change: 'Change node',
      checking: 'Checking compatibility…',
      connect: 'Connect',
      explanation:
        'Choose the node that will handle your data. This application’s code comes from the client distributor, not from that node.',
      incompatible: 'This node is not compatible with this client version.',
      invalid:
        'Enter an HTTPS address without credentials, query parameters or fragments. HTTP is only allowed on localhost.',
      label: 'Node address',
      notifications:
        'Could not disconnect notifications from the previous node. Retry before switching nodes.',
      registrationSwitchBody:
        'This registration link is for {node}. This browser is connected to {current}. Your identities on the current node stay there; you can come back with “Change node”.',
      registrationSwitchConfirm: 'Switch node and sign up',
      registrationSwitchKeep: 'Stay on the current node',
      registrationSwitchTitle: 'Sign up on another node?',
      storage: 'Could not save the node. Allow local storage to continue.',
      title: 'Connect to a node',
      unreachable:
        'Could not connect securely. Check the address, certificate and whether the node allows connections from this client.',
    };

function resumeClientAfterSelection(): void {
  const destination = new URL(window.location.href);
  destination.searchParams.delete('choose-node');

  if (destination.pathname === '/connect') {
    destination.pathname = '/';
    window.location.assign(destination.href);
  } else {
    window.history.replaceState(null, '', destination.href);
    window.location.reload();
  }
}

export function IndependentClient() {
  const [selected, setSelected] = useState(clientNodeForDocument);
  const [registration, setRegistration] = useState(pendingRegistrationLink);
  const choosing =
    window.location.pathname === '/connect' ||
    new URLSearchParams(window.location.search).get('choose-node') === '1';
  const nodeChoiceUrl = new URL(window.location.href);
  nodeChoiceUrl.searchParams.set('choose-node', '1');
  const changeNodeHref = window.location.pathname.startsWith(
    '/invite/community/',
  )
    ? nodeChoiceUrl.href
    : '/connect';
  const registrationNode =
    registration && !choosing && registration.node !== selected?.url
      ? registration.node
      : null;
  const [endpoint, setEndpoint] = useState(selected?.url ?? '');
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(
    !choosing && Boolean(registrationNode ? !selected : selected),
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selected || choosing || registrationNode || ready) return;
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
  }, [selected, choosing, registrationNode, ready]);

  async function adoptRegistrationNode(node: string): Promise<void> {
    setError('');
    setChecking(true);
    try {
      await new ClientCompatibilityProbe().verify(node);
    } catch (failure) {
      setEndpoint(node);
      setError(
        failure instanceof ClientConnectionError
          ? copy[failure.code]
          : copy.unreachable,
      );
      setChecking(false);

      return;
    }

    if (selected) {
      try {
        await retireClientNodeNotifications();
      } catch {
        setError(copy.notifications);
        setChecking(false);

        return;
      }
    }
    try {
      setSelected(await selectClientNodeForDocument(node));
      setEndpoint(node);
      setReady(true);
    } catch {
      setError(copy.storage);
    }
    setChecking(false);
  }

  function keepCurrentNode(): void {
    forgetRegistrationLink();
    setRegistration(null);
    setChecking(true);
  }

  useEffect(() => {
    if (registrationNode && !selected)
      void adoptRegistrationNode(registrationNode);
  }, [registrationNode, selected]);

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
      resumeClientAfterSelection();
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
          href={changeNodeHref}
        >
          {copy.change}
        </a>
        <Suspense fallback={<p role="status">{copy.checking}</p>}>
          <App />
        </Suspense>
      </>
    );

  if (registrationNode && selected)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-5 text-slate-100">
        <section className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-xl">
          <img src="/logo.png" alt="Pigeon Swarm" className="h-14 w-14" />
          <h1 className="text-2xl font-semibold">
            {copy.registrationSwitchTitle}
          </h1>
          <p className="text-sm break-all text-slate-300">
            {copy.registrationSwitchBody
              .replace('{node}', registrationNode)
              .replace('{current}', selected.url)}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={checking}
            onClick={() => void adoptRegistrationNode(registrationNode)}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {checking ? copy.checking : copy.registrationSwitchConfirm}
          </button>
          <button
            type="button"
            disabled={checking}
            onClick={keepCurrentNode}
            className="w-full rounded-lg border border-slate-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {copy.registrationSwitchKeep}
          </button>
        </section>
      </main>
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
