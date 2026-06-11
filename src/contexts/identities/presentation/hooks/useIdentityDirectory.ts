import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ConversationResource,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { ConversationPeer } from '../../../conversations/domain/ConversationPeer';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import {
  identityName,
  identityPicture,
  publicFileObjectUrl,
  type IdentityNames,
  type IdentityPictures,
} from '../view-models/identityDisplay';

type IdentityDirectoryInput = {
  conversations: ConversationResource[];
  messageAuthorIdentityIdsKey: string;
  notifications: NotificationResource[];
  session: Session;
};

type ResolvedIdentity = readonly [
  identityId: string,
  name: string,
  picture: null | string,
  identity: IdentityResource | null,
];

const IDENTITY_PROFILE_REFRESH_INTERVAL_MS = 15_000;

export function useIdentityDirectory({
  conversations,
  messageAuthorIdentityIdsKey,
  notifications,
  session,
}: IdentityDirectoryInput): {
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  rememberIdentity: (identity: IdentityResource) => void;
} {
  const [identityNames, setIdentityNames] = useState<IdentityNames>(() => ({
    [session.identity.id]:
      identityName(session.identity) ?? session.identity.id,
  }));
  const [identityProfiles, setIdentityProfiles] = useState<
    Record<string, IdentityResource>
  >(() => ({ [session.identity.id]: session.identity }));
  const [identityPictures, setIdentityPictures] = useState<IdentityPictures>(
    () => ({
      ...(identityPicture(session.identity)
        ? { [session.identity.id]: identityPicture(session.identity) as string }
        : {}),
    }),
  );
  const [resolvingIdentityIds, setResolvingIdentityIds] = useState<string[]>(
    [],
  );

  const rememberIdentity = useCallback((identity: IdentityResource) => {
    setIdentityNames((current) => ({
      ...current,
      [identity.id]: identityName(identity) ?? identity.id,
    }));
    setIdentityProfiles((current) => ({
      ...current,
      [identity.id]: identity,
    }));

    void loadIdentityPicture(identity)
      .then((picture) => {
        setIdentityPictures((current) => {
          const next = { ...current };

          if (picture) next[identity.id] = picture;
          else delete next[identity.id];

          return next;
        });
      })
      .catch(() => undefined);
  }, []);

  const identityIdsInUse = useMemo(() => {
    const ids = new Set<string>();

    conversations.forEach((conversation) => {
      const peerIdentityId = ConversationPeer.identityId(
        conversation,
        session.identity.id,
        session.keychain,
      );

      if (isResolvableIdentityId(peerIdentityId)) ids.add(peerIdentityId);
      conversation.participantIdentityIds?.forEach((identityId) =>
        isResolvableIdentityId(identityId) ? ids.add(identityId) : undefined,
      );
      conversation.participantIds?.forEach((identityId) =>
        isResolvableIdentityId(identityId) ? ids.add(identityId) : undefined,
      );
    });
    notifications.forEach((notification) => {
      if (notification.type === 'missed_call') {
        if (isResolvableIdentityId(notification.payload.callerIdentityId)) {
          ids.add(notification.payload.callerIdentityId);
        }
      } else {
        if (isResolvableIdentityId(notification.payload.inviterIdentityId)) {
          ids.add(notification.payload.inviterIdentityId);
        }
      }

      if (isResolvableIdentityId(notification.payload.recipientIdentityId)) {
        ids.add(notification.payload.recipientIdentityId);
      }
    });
    messageAuthorIdentityIdsKey
      .split('\u0000')
      .filter(isResolvableIdentityId)
      .forEach((identityId) => ids.add(identityId));
    ids.delete(session.identity.id);

    return [...ids].sort();
  }, [
    conversations,
    messageAuthorIdentityIdsKey,
    notifications,
    session.identity.id,
    session.keychain,
  ]);

  const applyResolvedIdentities = useCallback(
    (resolvedIdentities: ResolvedIdentity[]) => {
      setIdentityNames((current) => ({
        ...current,
        ...Object.fromEntries(
          resolvedIdentities.map(([identityId, name]) => [identityId, name]),
        ),
      }));
      setIdentityProfiles((current) => ({
        ...current,
        ...Object.fromEntries(
          resolvedIdentities
            .filter(([, , , identity]) => !!identity)
            .map(([identityId, , , identity]) => [
              identityId,
              identity as IdentityResource,
            ]),
        ),
      }));
      setIdentityPictures((current) => {
        const next = { ...current };

        resolvedIdentities.forEach(([identityId, , picture, identity]) => {
          if (!identity) return;

          if (picture) next[identityId] = picture;
          else delete next[identityId];
        });

        return next;
      });
    },
    [],
  );

  const resolveIdentityIds = useCallback(
    (identityIds: string[], options: { refresh?: boolean } = {}) => {
      const nextIdentityIds = identityIds.filter(
        (identityId) => !resolvingIdentityIds.includes(identityId),
      );

      if (nextIdentityIds.length === 0) return;

      setResolvingIdentityIds((current) => [
        ...new Set([...current, ...nextIdentityIds]),
      ]);

      void Promise.all(
        nextIdentityIds.map((identityId) =>
          resolveIdentity(identityId, options),
        ),
      ).then((resolvedIdentities) => {
        applyResolvedIdentities(resolvedIdentities);
        setResolvingIdentityIds((current) =>
          current.filter((identityId) => !nextIdentityIds.includes(identityId)),
        );
      });
    },
    [applyResolvedIdentities, resolvingIdentityIds],
  );

  const identityIdsToResolve = useMemo(
    () =>
      identityIdsInUse.filter((identityId) => !identityProfiles[identityId]),
    [identityIdsInUse, identityProfiles],
  );

  const identityIdsToRefresh = useMemo(
    () =>
      identityIdsInUse.filter((identityId) => !!identityProfiles[identityId]),
    [identityIdsInUse, identityProfiles],
  );

  useEffect(() => {
    rememberIdentity(session.identity);
  }, [rememberIdentity, session.identity]);

  useEffect(() => {
    if (identityIdsToResolve.length === 0) return;

    resolveIdentityIds(identityIdsToResolve);
  }, [identityIdsToResolve, resolveIdentityIds]);

  useEffect(() => {
    if (identityIdsToRefresh.length === 0) return undefined;

    const refreshIdentities = () =>
      resolveIdentityIds(identityIdsToRefresh, { refresh: true });
    const refreshVisibleIdentities = () => {
      if (document.visibilityState === 'visible') refreshIdentities();
    };
    const intervalId = window.setInterval(() => {
      refreshIdentities();
    }, IDENTITY_PROFILE_REFRESH_INTERVAL_MS);

    window.addEventListener('focus', refreshIdentities);
    document.addEventListener('visibilitychange', refreshVisibleIdentities);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIdentities);
      document.removeEventListener('visibilitychange', refreshVisibleIdentities);
    };
  }, [identityIdsToRefresh, resolveIdentityIds]);

  return {
    identityNames,
    identityPictures,
    identityProfiles,
    rememberIdentity,
  };
}

function isResolvableIdentityId(
  identityId?: null | string,
): identityId is string {
  if (!identityId) return false;

  const normalized = identityId.trim().toLowerCase();

  return (
    normalized !== '' && normalized !== 'system' && normalized !== 'unknown'
  );
}

async function resolveIdentity(
  identityId: string,
  options: { refresh?: boolean } = {},
): Promise<ResolvedIdentity> {
  try {
    const normalizedIdentityId = IdentityId.normalize(identityId);
    const identity = options.refresh
      ? await applicationContainer.refreshIdentity(normalizedIdentityId)
      : await applicationContainer.getIdentity(normalizedIdentityId);
    const picture = await loadIdentityPicture(identity).catch(() => null);

    return [
      identityId,
      identityName(identity) ?? identityId,
      picture,
      identity,
    ] as const;
  } catch {
    return [identityId, identityId, null, null] as const;
  }
}

async function loadIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  const content = await applicationContainer.getPublicFile(pictureCid);

  return publicFileObjectUrl(content);
}
