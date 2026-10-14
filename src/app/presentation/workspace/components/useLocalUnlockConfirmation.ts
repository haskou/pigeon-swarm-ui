import { useEffect, useState } from 'react';

import { applicationContainer } from '../../../composition/applicationContainer';

export type LocalUnlockConfirmation = {
  /** The password to confirm with, none for a passkey; clears the field. */
  consume: () => string | undefined;
  onPasswordChange: (value: string) => void;
  password: string;
  ready: boolean;
  usesPassword: boolean;
};

/**
 * Holds what confirms the person again before a sensitive step: the device
 * password, or the passkey when one unlocks this device (asked at confirm).
 */
export function useLocalUnlockConfirmation(
  identityId: string,
): LocalUnlockConfirmation {
  const [passkey, setPasskey] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    let active = true;

    void applicationContainer.identities.localUnlockMethod(identityId).then(
      (method) => {
        if (active) setPasskey(method === 'passkey');
      },
      () => undefined,
    );

    return () => {
      active = false;
    };
  }, [identityId]);

  return {
    consume: () => {
      setPassword('');

      return passkey ? undefined : password;
    },
    onPasswordChange: setPassword,
    password,
    ready: passkey || password.length > 0,
    usesPassword: !passkey,
  };
}
