import type { ReactElement } from 'react';

import type { LoginIdentityProgressStep } from '../../application/login-identity/LoginIdentityProgressStep';
import type { AuthMode } from './authFormRules';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function LoginNodeStartingNotice({
  mode,
  step,
}: {
  mode: AuthMode;
  step: LoginIdentityProgressStep | null;
}): ReactElement | null {
  if (mode !== 'login' || step !== 'node-starting') return null;

  return (
    <p
      className="mt-2 text-center text-xs leading-snug text-white/70"
      data-testid="auth-node-starting"
      role="status"
    >
      {copy.auth.loginProgress.nodeStartingHelp}
    </p>
  );
}
