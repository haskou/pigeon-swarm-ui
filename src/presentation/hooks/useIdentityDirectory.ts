import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ChatMessage,
  ConversationResource,
  IdentityResource,
  NotificationResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { conversationPeerIdentityId } from '../../domain/conversations/conversationPeer';
import {
  identityName,
  identityPicture,
  profilePictureDataUrl,
  type IdentityNames,
  type IdentityPictures,
} from '../../utils/identityDisplay';

type IdentityDirectoryInput = {
  conversations: ConversationResource[];
  messages: ChatMessage[];
  notifications: NotificationResource[];
  session: Session;
};

type ResolvedIdentity = readonly [
  identityId: string,
  name: string,
  picture: null | string,
  identity: IdentityResource | null,
];

export function useIdentityDirectory({
  conversations,
  messages,
  notifications,
  session,
}: IdentityDirectoryInput): {
  identityNames: IdentityNames;
  identityPictures: IdentityPictures;
  identityProfiles: Record<string, IdentityResource>;
  rememberIdentity: (identity: IdentityResource) => void;
} {
  const [identityNames, setIdentityNames] = useState<IdentityNames>(() => ({
    [session.identity.id]: identityName(session.identity) ?? session.identity.id,
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

  const identityIdsToResolve = useMemo(() => {
    const ids = new Set<string>();

    conversations.forEach((conversation) => {
      const peerIdentityId = conversationPeerIdentityId(
        conversation,
        session.identity.id,
        session.keychain,
      );

      if (peerIdentityId) ids.add(peerIdentityId);
      conversation.participantIdentityIds?.forEach((identityId) =>
        ids.add(identityId),
      );
      conversation.participantIds?.forEach((identityId) => ids.add(identityId));
    });
    notifications.forEach((notification) => {
      ids.add(notification.payload.inviterIdentityId);
      ids.add(notification.payload.recipientIdentityId);
    });
    messages.forEach((message) => ids.add(message.authorIdentityId));
    ids.delete(session.identity.id);

    return [...ids].filter(
      (identityId) =>
        !identityNames[identityId] &&
        !resolvingIdentityIds.includes(identityId),
    );
  }, [
    conversations,
    identityNames,
    messages,
    notifications,
    resolvingIdentityIds,
    session.identity.id,
    session.keychain,
  ]);

  useEffect(() => {
    rememberIdentity(session.identity);
  }, [rememberIdentity, session.identity]);

  useEffect(() => {
    if (identityIdsToResolve.length === 0) return;

    setResolvingIdentityIds((current) => [
      ...new Set([...current, ...identityIdsToResolve]),
    ]);

    void Promise.all(identityIdsToResolve.map(resolveIdentity)).then(
      (resolvedIdentities) => {
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
        setIdentityPictures((current) => ({
          ...current,
          ...Object.fromEntries(
            resolvedIdentities
              .filter(([, , picture]) => !!picture)
              .map(([identityId, , picture]) => [identityId, picture as string]),
          ),
        }));
        setResolvingIdentityIds((current) =>
          current.filter(
            (identityId) => !identityIdsToResolve.includes(identityId),
          ),
        );
      },
    );
  }, [identityIdsToResolve]);

  return {
    identityNames,
    identityPictures,
    identityProfiles,
    rememberIdentity,
  };
}

async function resolveIdentity(identityId: string): Promise<ResolvedIdentity> {
  try {
    const identity = await pigeonApplication.getIdentity(identityId);
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

  const content = await pigeonApplication.getPublicFile(pictureCid);

  return profilePictureDataUrl(content);
}
