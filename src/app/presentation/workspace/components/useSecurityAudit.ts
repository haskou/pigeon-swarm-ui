import { useEffect, useMemo, useState } from 'react';

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { MlsGroupCredentials } from '../../../../contexts/communities/infrastructure/mls/MlsGroupCredentials';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { SecurityAuditState } from './SecurityAuditState';

import {
  applicationContainer,
  contactPinStore,
} from '../../../composition/applicationContainer';
import { SecurityAuditReport } from './SecurityAuditReport';

type SecurityAuditSources = {
  devices: string[] | null;
  groups: Record<string, MlsGroupCredentials>;
  sealedRootGeneration: number | null;
};

/** Each source fails on its own: one unreachable endpoint hides one block. */
async function loadSources(
  session: Session,
  communityIds: string[],
): Promise<SecurityAuditSources> {
  const [devices, sealedRootGeneration, groups] = await Promise.all([
    applicationContainer.identities.listDevices(session).then(
      (credentials) => credentials.map((credential) => credential.valueOf()),
      () => null,
    ),
    applicationContainer.identities
      .deviceSealedRootGeneration(session)
      .catch(() => null),
    Promise.all(
      communityIds.map(async (communityId) => ({
        communityId,
        credentials: await applicationContainer.mls
          .credentials(session, communityId)
          .catch(() => null),
      })),
    ),
  ]);

  return {
    devices,
    groups: Object.fromEntries(
      groups.flatMap(({ communityId, credentials }) =>
        credentials ? [[communityId, credentials]] : [],
      ),
    ),
    sealedRootGeneration,
  };
}

/** Loads the audit only while the view is expanded. */
export function useSecurityAudit({
  communities,
  conversations,
  enabled,
  identityNames,
  identityProfiles,
  session,
}: {
  communities: Community[];
  conversations: ConversationResource[];
  enabled: boolean;
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  session: Session;
}): SecurityAuditState {
  const [sources, setSources] = useState<SecurityAuditSources | null>(null);
  const [revision, setRevision] = useState(0);
  const communityIdList = communities.map(({ id }) => id).join('\n');

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    void loadSources(
      session,
      communityIdList ? communityIdList.split('\n') : [],
    ).then((loaded) => {
      if (active) setSources(loaded);
    });

    return () => {
      active = false;
    };
  }, [communityIdList, enabled, revision, session]);

  const audit = useMemo(() => {
    if (!enabled || !sources) return null;

    const identityId = session.identity.id;

    return SecurityAuditReport.from({
      communities,
      conversations,
      devices: sources.devices,
      groups: sources.groups,
      identityNames,
      identityProfiles,
      mailboxId: (conversationId, recipientIdentityId) =>
        applicationContainer.directMessages.mailboxId(
          session,
          conversationId,
          recipientIdentityId,
        ),
      outbox: conversations.flatMap(({ id }) =>
        applicationContainer.directMessages.outboxItems(identityId, id),
      ),
      pins: contactPinStore.load(identityId),
      sealedRootGeneration: sources.sealedRootGeneration,
      session,
    });
    // `revision` re-reads the contact pins after a verification change.
  }, [
    communities,
    conversations,
    enabled,
    identityNames,
    identityProfiles,
    revision,
    session,
    sources,
  ]);

  return {
    audit,
    devicesFailed: Boolean(sources && !sources.devices),
    refresh: () => setRevision((current) => current + 1),
  };
}
