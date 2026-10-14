import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../../communities/infrastructure/http/resources/CommunityMembershipRequestResource';
import type { ConversationResource } from '../../../conversations/infrastructure/http/ConversationResource';
import type { NotificationResource } from '../../../notifications/infrastructure/http/resources/NotificationResource';
import type { IdentityResource } from '../../infrastructure/http/resources/IdentityResource';
import type { Session } from '../../infrastructure/session/Session';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { ConversationPeer } from '../../../conversations/presentation/view-models/ConversationPeer';
import { IdentityMatch } from '../../domain/IdentityMatch';
import { IdentityId } from '../../domain/value-objects/IdentityId';
import { ContactDirectory } from '../view-models/ContactDirectory';
import {
  identityName,
  identityPicture,
  publicFileObjectUrl,
  type IdentityNames,
  type IdentityPictures,
} from '../view-models/identityDisplay';
import {
  identityIdsAwaitingResolution,
  resolvedIdentityNames,
  unresolvedIdentityIdsAfter,
} from '../view-models/identityResolution';

type IdentityDirectoryInput = {
  conversations: ConversationResource[];
  membershipRequests: CommunityMembershipRequest[];
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

const IDENTITY_PROFILE_REFRESH_INTERVAL_MS = 5 * 60_000;
const IDENTITY_PROFILE_FOCUS_REFRESH_THROTTLE_MS = 60_000;
// Contacts are stamped by day, so the sealed directory is rewritten when a
// name changes or once a day, not on every profile refresh.
const CONTACT_SEEN_RESOLUTION_MS = 24 * 60 * 60_000;

export function useIdentityDirectory({
  conversations,
  membershipRequests,
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
  const [unresolvedIdentityIds, setUnresolvedIdentityIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [storedContacts, setStoredContacts] = useState<{
    directory: ContactDirectory;
    ownerIdentityId: string;
  } | null>(null);
  const lastIdentityRefreshAtRef = useRef(0);

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
      conversation.participantIds.forEach((identityId) =>
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
    membershipRequests.forEach((request) => {
      if (isResolvableIdentityId(request.identityId)) {
        ids.add(request.identityId);
      }

      if (isResolvableIdentityId(request.creatorIdentityId)) {
        ids.add(request.creatorIdentityId);
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
    membershipRequests,
    messageAuthorIdentityIdsKey,
    notifications,
    session.identity.id,
    session.keychain,
  ]);

  const applyResolvedIdentities = useCallback(
    (resolvedIdentities: ResolvedIdentity[]) => {
      const lookups = resolvedIdentities.map(
        ([identityId, , , identity]) => [identityId, identity] as const,
      );

      setIdentityNames((current) => resolvedIdentityNames(current, lookups));
      setUnresolvedIdentityIds((current) =>
        unresolvedIdentityIdsAfter(current, lookups),
      );
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
      identityIdsAwaitingResolution(
        identityIdsInUse,
        identityProfiles,
        unresolvedIdentityIds,
      ),
    [identityIdsInUse, identityProfiles, unresolvedIdentityIds],
  );

  const identityIdsToRefresh = useMemo(
    () =>
      identityIdsInUse.filter(
        (identityId) =>
          !!identityProfiles[identityId] ||
          unresolvedIdentityIds.has(identityId),
      ),
    [identityIdsInUse, identityProfiles, unresolvedIdentityIds],
  );

  useEffect(() => {
    rememberIdentity(session.identity);
  }, [rememberIdentity, session.identity]);

  useEffect(() => {
    let active = true;

    void applicationContainer.identities
      .knownContacts(session)
      .catch(() => [])
      .then((entries) => {
        if (!active) return;

        const directory = ContactDirectory.of(entries);

        setIdentityNames((current) => directory.knownNames(current));
        setStoredContacts({
          directory,
          ownerIdentityId: session.identity.id,
        });
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (
      !storedContacts ||
      !IdentityMatch.isSame(storedContacts.ownerIdentityId, session.identity.id)
    ) {
      return;
    }

    const directory = storedContacts.directory.remember(
      identityProfiles,
      Math.floor(Date.now() / CONTACT_SEEN_RESOLUTION_MS) *
        CONTACT_SEEN_RESOLUTION_MS,
      session.identity.id,
    );

    if (directory.isSameAs(storedContacts.directory)) return;

    setStoredContacts({ directory, ownerIdentityId: session.identity.id });
    void applicationContainer.identities
      .rememberContacts(session, directory.entries())
      .catch(() => undefined);
  }, [identityProfiles, session, storedContacts]);

  useEffect(() => {
    if (identityIdsToResolve.length === 0) return;

    resolveIdentityIds(identityIdsToResolve);
  }, [identityIdsToResolve, resolveIdentityIds]);

  useEffect(() => {
    if (identityIdsToRefresh.length === 0) return undefined;

    const refreshIdentities = (options: { force?: boolean } = {}) => {
      const now = Date.now();

      if (
        !options.force &&
        now - lastIdentityRefreshAtRef.current <
          IDENTITY_PROFILE_FOCUS_REFRESH_THROTTLE_MS
      ) {
        return;
      }

      lastIdentityRefreshAtRef.current = now;
      resolveIdentityIds(identityIdsToRefresh, { refresh: true });
    };
    const refreshVisibleIdentities = () => {
      if (document.visibilityState === 'visible') refreshIdentities();
    };
    const refreshFocusedIdentities = () => refreshIdentities();
    const intervalId = window.setInterval(() => {
      refreshIdentities({ force: true });
    }, IDENTITY_PROFILE_REFRESH_INTERVAL_MS);

    window.addEventListener('focus', refreshFocusedIdentities);
    document.addEventListener('visibilitychange', refreshVisibleIdentities);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshFocusedIdentities);
      document.removeEventListener(
        'visibilitychange',
        refreshVisibleIdentities,
      );
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
      ? await applicationContainer.identities.refresh(normalizedIdentityId)
      : await applicationContainer.identities.get(normalizedIdentityId);
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

  const content =
    await applicationContainer.attachments.getPublicFile(pictureCid);

  return publicFileObjectUrl(content);
}
