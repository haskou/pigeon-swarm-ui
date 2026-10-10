export type NetworkChangeEnvironment = {
  connection?: EventTarget;
  events: EventTarget;
};

/**
 * Calls `onChange` when the browser regains connectivity or the network
 * connection changes. Returns a cleanup that removes every listener.
 */
export function watchNetworkChanges(
  onChange: () => void,
  environment: NetworkChangeEnvironment = browserNetworkChangeEnvironment(),
): () => void {
  environment.events.addEventListener('online', onChange);
  environment.connection?.addEventListener('change', onChange);

  return () => {
    environment.events.removeEventListener('online', onChange);
    environment.connection?.removeEventListener('change', onChange);
  };
}

function browserNetworkChangeEnvironment(): NetworkChangeEnvironment {
  return {
    connection: (navigator as Navigator & { connection?: EventTarget })
      .connection,
    events: window,
  };
}
