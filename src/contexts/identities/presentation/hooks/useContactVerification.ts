import { useEffect, useState } from 'react';

import { contactPinStore } from '../../../../app/composition/applicationContainer';
import { SafetyNumber } from '../../infrastructure/crypto/SafetyNumber';

export type ContactVerification = {
  markVerified: () => boolean;
  removeVerification: () => boolean;
  verified: boolean;
};

export function useContactVerification({
  localIdentityId,
  peerHandle,
  peerIdentityId,
}: {
  localIdentityId: string;
  peerHandle?: string | null;
  peerIdentityId?: string;
}): ContactVerification {
  const [, setRevision] = useState(0);
  const verified =
    !!peerIdentityId &&
    !!contactPinStore.load(localIdentityId)[peerIdentityId]?.verifiedAt;

  const markVerified = () => {
    if (!peerIdentityId) return false;

    try {
      contactPinStore.verify(
        localIdentityId,
        peerIdentityId,
        peerHandle ?? undefined,
      );
    } catch {
      return false;
    }

    setRevision((revision) => revision + 1);
    return true;
  };

  const removeVerification = () => {
    if (!peerIdentityId) return false;

    try {
      contactPinStore.unverify(localIdentityId, peerIdentityId);
    } catch {
      return false;
    }

    setRevision((revision) => revision + 1);
    return true;
  };

  return { markVerified, removeVerification, verified };
}

export function useSafetyNumber(
  localIdentityId: string,
  peerIdentityId: string,
): string[] | null {
  const [groups, setGroups] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    setGroups(null);

    void SafetyNumber.between(localIdentityId, peerIdentityId).then((value) => {
      if (active) setGroups(value);
    });

    return () => {
      active = false;
    };
  }, [localIdentityId, peerIdentityId]);

  return groups;
}
