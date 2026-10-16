import type { Dispatch, FormEvent, SetStateAction } from 'react';

import { useCallback, useEffect, useState } from 'react';

import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { applicationContainer } from '../../../composition/applicationContainer';
import { normalizeIdentityLookup } from './normalizeIdentityLookup';

export interface GroupInvitationDialogController {
  close: () => void;
  error: string | null;
  input: string;
  loading: boolean;
  open: boolean;
  setInput: Dispatch<SetStateAction<string>>;
  show: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useGroupInvitationDialog({
  conversation,
  enabled,
  onInvited,
  request,
  session,
}: {
  conversation?: ConversationResource;
  enabled: boolean;
  onInvited: () => Promise<unknown>;
  request: number;
  session: Session;
}): GroupInvitationDialogController {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (request && enabled) show();
  }, [enabled, request, show]);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!conversation || loading) return;

      const recipientIdentityId = normalizeIdentityLookup(input);

      if (!recipientIdentityId) return;

      setLoading(true);
      setError(null);
      try {
        await applicationContainer.conversations.inviteToGroup(
          session,
          conversation.id,
          recipientIdentityId,
        );
        await onInvited();
        setInput('');
        setOpen(false);
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.chat.inviteError));
      } finally {
        setLoading(false);
      }
    },
    [conversation, input, loading, onInvited, session],
  );

  return {
    close,
    error,
    input,
    loading,
    open,
    setInput,
    show,
    submit,
  };
}
