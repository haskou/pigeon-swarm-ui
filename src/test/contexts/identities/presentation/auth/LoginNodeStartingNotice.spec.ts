import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { LoginIdentityProgressStep } from '../../../../../contexts/identities/application/login-identity/LoginIdentityProgressStep';
import type { AuthMode } from '../../../../../contexts/identities/presentation/auth/authFormRules';

import { LoginNodeStartingNotice } from '../../../../../contexts/identities/presentation/auth/LoginNodeStartingNotice';
import { copy } from '../../../../../shared/presentation/i18n/copy';

function render(
  mode: AuthMode,
  step: LoginIdentityProgressStep | null,
): string {
  return renderToStaticMarkup(
    createElement(LoginNodeStartingNotice, { mode, step }),
  );
}

describe(LoginNodeStartingNotice.name, () => {
  it('shows a status while sign-in waits on a node that is still starting', () => {
    const html = render('login', 'node-starting');

    expect(html).toContain('data-testid="auth-node-starting"');
    expect(html).toContain('role="status"');
    expect(html).toContain(copy.auth.loginProgress.nodeStartingHelp);
  });

  it('disappears once sign-in moves on past the node start', () => {
    expect(render('login', 'decrypting-keys')).toBe('');
    expect(render('login', 'resolving-identity')).toBe('');
  });

  it('is absent when no sign-in is in progress', () => {
    expect(render('login', null)).toBe('');
  });

  it('is never shown outside login', () => {
    expect(render('create', 'node-starting')).toBe('');
  });
});
