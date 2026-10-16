import { useCallback, useState } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

export interface NodeAccessAction {
  busy: null | string;
  error: null | string;
  notice: null | string;
  run: (
    name: string,
    action: () => Promise<void>,
    options?: { failure?: string; success?: string },
  ) => Promise<void>;
}

/** Runs one node owner change at a time and reports how it went. */
export function useNodeAccessAction(): NodeAccessAction {
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const [notice, setNotice] = useState<null | string>(null);

  const run = useCallback<NodeAccessAction['run']>(
    async (name, action, options = {}) => {
      setBusy(name);
      setError(null);
      setNotice(null);
      try {
        await action();
        setNotice(options.success ?? null);
      } catch (caught) {
        setError(
          toUserErrorMessage(
            caught,
            options.failure ?? copy.nodeAccess.saveError,
          ),
        );
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  return { busy, error, notice, run };
}
