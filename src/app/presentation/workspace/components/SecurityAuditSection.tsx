import { type ReactNode, useState } from 'react';

import type { CommunityResource as Community } from '../../../../contexts/communities/infrastructure/http/resources/CommunityResource';
import type { ConversationResource } from '../../../../contexts/conversations/infrastructure/http/ConversationResource';
import type { IdentityResource } from '../../../../contexts/identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type { SecurityAudit } from './SecurityAudit';

import { ContactVerificationDialog } from '../../../../contexts/identities/presentation/components/ContactVerificationDialog';
import { useContactVerification } from '../../../../contexts/identities/presentation/hooks/useContactVerification';
import { cx } from '../../../../shared/presentation/cx';
import {
  formatDateSeparator,
  formatTime,
} from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { CopyableIdRow } from './CopyableIdRow';
import { useSecurityAudit } from './useSecurityAudit';

type SecurityAuditSectionProps = {
  communities: Community[];
  conversations: ConversationResource[];
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  session: Session;
};

function AuditPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'good' | 'muted' | 'warn';
}) {
  return (
    <span
      className={cx(
        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black',
        tone === 'good' && 'bg-emerald-400/15 text-emerald-200',
        tone === 'muted' && 'bg-white/10 text-white/60',
        tone === 'warn' && 'bg-amber-400/15 text-amber-200',
      )}
    >
      {children}
    </span>
  );
}

function AuditValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <div className="text-xs font-bold text-white/45">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-white/80">{value}</div>
    </div>
  );
}

function AuditBlock({
  children,
  empty,
  title,
}: {
  children: ReactNode[];
  empty: string;
  title: string;
}) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {title}
      </h4>
      {children.length > 0 ? (
        <div className="grid gap-2">{children}</div>
      ) : (
        <p className="text-xs font-semibold text-white/45">{empty}</p>
      )}
    </div>
  );
}

function AuditCard({
  badge,
  children,
  testId,
  title,
}: {
  badge?: ReactNode;
  children: ReactNode;
  testId?: string;
  title: string;
}) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="min-w-0 truncate text-sm font-black text-white/80">
          {title}
        </span>
        {badge}
      </div>
      <div className="divide-y divide-white/[0.06]">{children}</div>
    </div>
  );
}

function AuditAccount({ account }: { account: SecurityAudit['account'] }) {
  return (
    <AuditCard
      testId="security-audit-account"
      title={copy.securityAudit.account}
    >
      <CopyableIdRow
        label={copy.securityAudit.identityId}
        value={account.identityId}
      />
      <CopyableIdRow
        label={copy.securityAudit.identityKey}
        value={account.identityKeyFingerprint}
      />
      <CopyableIdRow
        label={copy.securityAudit.deviceId}
        value={account.deviceId}
      />
      <CopyableIdRow
        label={copy.securityAudit.deviceCredential}
        value={account.deviceCredentialFingerprint}
      />
      <AuditValue
        label={copy.securityAudit.authorizationEpoch}
        value={account.authorizationEpoch}
      />
      <AuditValue
        label={copy.securityAudit.authorizationRevision}
        value={String(account.authorizationRevision)}
      />
      <CopyableIdRow
        label={copy.securityAudit.sealedRoot}
        value={account.sealedRoot.fingerprint}
      />
      <AuditValue
        label={copy.securityAudit.sealedRootGeneration}
        value={
          account.sealedRoot.generation === null
            ? copy.securityAudit.sealedRootAbsent
            : String(account.sealedRoot.generation)
        }
      />
    </AuditCard>
  );
}

function AuditContact({
  contact,
  localIdentityId,
  onVerificationChange,
}: {
  contact: SecurityAudit['contacts'][number];
  localIdentityId: string;
  onVerificationChange: () => void;
}) {
  const [comparing, setComparing] = useState(false);
  const verification = useContactVerification({
    localIdentityId,
    peerIdentityId: contact.identityId,
  });

  return (
    <AuditCard
      badge={
        <AuditPill tone={contact.verified ? 'good' : 'warn'}>
          {contact.verified
            ? copy.securityAudit.verified
            : copy.securityAudit.unverified}
        </AuditPill>
      }
      title={contact.name}
    >
      <CopyableIdRow
        label={copy.securityAudit.identityId}
        value={contact.identityId}
      />
      <CopyableIdRow
        label={copy.securityAudit.identityKey}
        value={contact.keyFingerprint}
      />
      <div className="py-2.5">
        <button
          className="ui-button w-full"
          data-testid="security-audit-compare"
          onClick={() => setComparing(true)}
          type="button"
        >
          {copy.securityAudit.compareSafetyNumber}
        </button>
      </div>
      {comparing && (
        <ContactVerificationDialog
          localIdentityId={localIdentityId}
          name={contact.name}
          onClose={() => {
            setComparing(false);
            onVerificationChange();
          }}
          peerIdentityId={contact.identityId}
          verification={verification}
        />
      )}
    </AuditCard>
  );
}

function AuditConversation({
  conversation,
}: {
  conversation: SecurityAudit['conversations'][number];
}) {
  const community = conversation.kind === 'community';

  return (
    <AuditCard
      badge={
        <AuditPill tone="muted">
          {copy.encryption.keyVersion} {conversation.keyVersion}
        </AuditPill>
      }
      title={conversation.title}
    >
      <CopyableIdRow
        label={
          community
            ? copy.securityAudit.communityId
            : copy.securityAudit.conversationId
        }
        value={conversation.conversationId}
      />
      <CopyableIdRow
        label={copy.securityAudit.keyFingerprint}
        value={conversation.keyFingerprint}
      />
      {!community && (
        <>
          <CopyableIdRow
            label={copy.securityAudit.peerIdentity}
            value={conversation.peerIdentityId}
          />
          <CopyableIdRow
            label={copy.securityAudit.incomingMailbox}
            value={conversation.incomingMailboxId}
          />
          <CopyableIdRow
            label={copy.securityAudit.outgoingMailbox}
            value={conversation.outgoingMailboxId}
          />
        </>
      )}
    </AuditCard>
  );
}

function AuditGroup({ group }: { group: SecurityAudit['groups'][number] }) {
  return (
    <AuditCard
      badge={
        <AuditPill tone="muted">
          {copy.securityAudit.epoch} {group.epoch}
        </AuditPill>
      }
      title={group.title}
    >
      <CopyableIdRow
        label={copy.securityAudit.communityId}
        value={group.communityId}
      />
      {group.leaves.map((leaf) => (
        <div key={`${leaf.identityId}:${leaf.deviceId}`} className="py-1">
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-xs font-black text-white/60">
              {copy.securityAudit.member}
            </span>
            {leaf.own && (
              <AuditPill tone="good">{copy.profile.deviceCurrent}</AuditPill>
            )}
          </div>
          <CopyableIdRow
            label={copy.securityAudit.identityId}
            value={leaf.identityId}
          />
          <CopyableIdRow
            label={copy.securityAudit.deviceId}
            value={leaf.deviceId}
          />
          <CopyableIdRow
            label={copy.securityAudit.signatureKey}
            value={leaf.signatureKeyFingerprint}
          />
        </div>
      ))}
    </AuditCard>
  );
}

function AuditReport({
  audit,
  devicesFailed,
  localIdentityId,
  onVerificationChange,
}: {
  audit: SecurityAudit;
  devicesFailed: boolean;
  localIdentityId: string;
  onVerificationChange: () => void;
}) {
  return (
    <div data-testid="security-audit-report">
      <AuditAccount account={audit.account} />
      <AuditBlock
        empty={copy.profile.deviceListError}
        title={copy.securityAudit.devices}
      >
        {devicesFailed
          ? []
          : (audit.devices ?? []).map((device) => (
              <AuditCard
                badge={
                  <AuditPill tone={device.current ? 'good' : 'muted'}>
                    {device.current
                      ? copy.profile.deviceCurrent
                      : copy.securityAudit.otherDevice}
                  </AuditPill>
                }
                key={device.credentialFingerprint}
                title={copy.securityAudit.deviceCredential}
              >
                <CopyableIdRow
                  label={copy.securityAudit.keyFingerprint}
                  value={device.credentialFingerprint}
                />
              </AuditCard>
            ))}
      </AuditBlock>
      <AuditBlock
        empty={copy.securityAudit.emptyContacts}
        title={copy.securityAudit.contacts}
      >
        {audit.contacts.map((contact) => (
          <AuditContact
            contact={contact}
            key={contact.identityId}
            localIdentityId={localIdentityId}
            onVerificationChange={onVerificationChange}
          />
        ))}
      </AuditBlock>
      <AuditBlock
        empty={copy.securityAudit.emptyConversations}
        title={copy.securityAudit.conversations}
      >
        {audit.conversations.map((conversation) => (
          <AuditConversation
            conversation={conversation}
            key={conversation.conversationId}
          />
        ))}
      </AuditBlock>
      <AuditBlock
        empty={copy.securityAudit.emptyGroups}
        title={copy.securityAudit.groups}
      >
        {audit.groups.map((group) => (
          <AuditGroup group={group} key={group.communityId} />
        ))}
      </AuditBlock>
      <AuditBlock
        empty={copy.securityAudit.emptyOutbox}
        title={copy.securityAudit.outbox}
      >
        {audit.outbox.map((entry) => (
          <AuditCard
            badge={
              <AuditPill tone={entry.state === 'failed' ? 'warn' : 'muted'}>
                {copy.securityAudit.states[entry.state]}
              </AuditPill>
            }
            key={entry.envelopeId}
            title={`${formatDateSeparator(entry.createdAt)} ${formatTime(
              entry.createdAt,
            )}`}
          >
            <CopyableIdRow
              label={copy.securityAudit.envelopeId}
              value={entry.envelopeId}
            />
            <CopyableIdRow
              label={copy.securityAudit.conversationId}
              value={entry.conversationId}
            />
          </AuditCard>
        ))}
      </AuditBlock>
    </div>
  );
}

/**
 * Read-only ids and key fingerprints of this account. Collapsed by default
 * and loaded only when opened, so the simple settings stay unchanged.
 */
export function SecurityAuditSection({
  communities,
  conversations,
  identityNames,
  identityProfiles,
  session,
}: SecurityAuditSectionProps) {
  const [open, setOpen] = useState(false);
  const { audit, devicesFailed, refresh } = useSecurityAudit({
    communities,
    conversations,
    enabled: open,
    identityNames,
    identityProfiles,
    session,
  });

  return (
    <section className="ui-section">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-black text-white/75 transition hover:bg-white/5"
        aria-controls="security-audit-panel"
        aria-expanded={open}
        data-testid="security-audit-toggle"
      >
        <span className="min-w-0">
          <span className="block">{copy.securityAudit.title}</span>
          <span className="mt-1 block text-xs font-bold text-white/40">
            {copy.securityAudit.help}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'text-white/45 transition-transform',
            open && 'rotate-180',
          )}
        >
          ⌄
        </span>
      </button>
      {open && (
        <div
          className="border-t border-white/[0.06] px-4 pb-5 pt-4"
          id="security-audit-panel"
        >
          {audit ? (
            <AuditReport
              audit={audit}
              devicesFailed={devicesFailed}
              localIdentityId={session.identity.id}
              onVerificationChange={refresh}
            />
          ) : (
            <p
              aria-live="polite"
              className="text-xs font-semibold text-white/45"
            >
              {copy.securityAudit.loading}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
