import { type FormEvent, type ReactElement, useEffect, useState } from 'react';

import type { Session } from '../../../../contexts/identities/infrastructure/session/Session';
import type {
  NodeRegistrationCodeViewModel,
  NodeRegistrationModeViewModel,
} from '../../../../contexts/nodeAccess/presentation/view-models/NodeAccessViewModels';
import type { NodeAccessAction } from './useNodeAccessAction';

import { Field } from '../../../../contexts/identities/presentation/auth/Field';
import { createRegistrationUrl } from '../../../../contexts/nodeAccess/presentation/view-models/registrationLink';
import { QrCode } from '../../../../shared/presentation/components/QrCode';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { API_SERVER_URL } from '../../../API_SERVER_URL';
import { applicationContainer } from '../../../composition/applicationContainer';
import {
  formatNodeAccessDate,
  NodeAccessEmpty,
  NodeAccessSection,
  NodeAccessStatus,
} from './NodeAccessParts';
import { useNodeAccessAction } from './useNodeAccessAction';

const HOUR = 60 * 60 * 1000;
const DEFAULT_EXPIRY = 24 * HOUR;
const MAX_CODE_USES = 100;

const expiryOptions = [
  { label: copy.nodeAccess.expiryHour, value: HOUR },
  { label: copy.nodeAccess.expiryDay, value: DEFAULT_EXPIRY },
  { label: copy.nodeAccess.expiryWeek, value: 7 * DEFAULT_EXPIRY },
  { label: copy.nodeAccess.expiryMonth, value: 30 * DEFAULT_EXPIRY },
];

const modeHelp: Record<NodeRegistrationModeViewModel, string> = {
  closed: copy.nodeAccess.modeClosedHelp,
  codes: copy.nodeAccess.modeCodesHelp,
  open: copy.nodeAccess.modeOpenHelp,
};

function IssuedRegistrationLink({
  link,
  onDone,
}: {
  link: string;
  onDone: () => void;
}): ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="grid gap-3 rounded-2xl border border-cyan-200/25 bg-cyan-300/10 p-4"
      data-testid="node-registration-link"
    >
      <div>
        <div className="text-sm font-black text-white/85">
          {copy.nodeAccess.issuedTitle}
        </div>
        <p className="mt-1 text-sm leading-6 text-white/55">
          {copy.nodeAccess.issuedBody}
        </p>
      </div>
      <div className="mx-auto w-full max-w-[14rem] rounded-xl bg-white p-2">
        <QrCode label={copy.nodeAccess.linkQrLabel} value={link} />
      </div>
      <input
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className="ui-field-control px-3 py-2 font-mono text-xs"
        aria-label={copy.nodeAccess.copyLink}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="ui-button ui-button-primary"
          disabled={!navigator.clipboard}
          onClick={() => {
            void navigator.clipboard
              .writeText(link)
              .then(() => setCopied(true));
          }}
        >
          {copied ? copy.nodeAccess.linkCopied : copy.nodeAccess.copyLink}
        </button>
        <button type="button" className="ui-button" onClick={onDone}>
          {copy.nodeAccess.linkDone}
        </button>
      </div>
    </div>
  );
}

function RegistrationCodeRow({
  code,
  disabled,
  onRevoke,
}: {
  code: NodeRegistrationCodeViewModel;
  disabled: boolean;
  onRevoke: () => void;
}): ReactElement {
  return (
    <div className="ui-list-row" data-code-id={code.id}>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-white/85">
          {copy.nodeAccess.codeUses
            .replace('{left}', String(code.usesLeft))
            .replace('{max}', String(code.maxUses))}
        </div>
        <div className="text-xs text-white/45">
          {code.expiresAt <= Date.now()
            ? copy.nodeAccess.codeExpired
            : copy.nodeAccess.codeExpires.replace(
                '{date}',
                formatNodeAccessDate(code.expiresAt),
              )}
        </div>
      </div>
      <button
        type="button"
        className="ui-button ui-button-danger"
        disabled={disabled}
        onClick={onRevoke}
      >
        {copy.nodeAccess.revoke}
      </button>
    </div>
  );
}

function CreateRegistrationLink({
  action,
  onIssued,
  session,
}: {
  action: NodeAccessAction;
  onIssued: (codes: NodeRegistrationCodeViewModel[]) => void;
  session: Session;
}): ReactElement {
  const { busy, run } = action;
  const [uses, setUses] = useState('1');
  const [expiry, setExpiry] = useState(DEFAULT_EXPIRY);
  const [issuedLink, setIssuedLink] = useState<null | string>(null);
  const maxUses = Number(uses);
  const usesValid =
    Number.isInteger(maxUses) && maxUses >= 1 && maxUses <= MAX_CODE_USES;

  const issueCode = (event: FormEvent) => {
    event.preventDefault();

    if (!usesValid || busy) return;

    void run('issue', async () => {
      const issued =
        await applicationContainer.nodeAccess.issueRegistrationCode(
          { expiresAt: Date.now() + expiry, maxUses },
          session,
        );

      setIssuedLink(
        createRegistrationUrl({ code: issued.code, node: API_SERVER_URL }),
      );
      onIssued(
        await applicationContainer.nodeAccess.getRegistrationCodes(session),
      );
    });
  };

  return (
    <NodeAccessSection title={copy.nodeAccess.createLinkTitle}>
      {issuedLink ? (
        <IssuedRegistrationLink
          link={issuedLink}
          onDone={() => setIssuedLink(null)}
        />
      ) : (
        <form
          className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={issueCode}
        >
          <Field label={copy.nodeAccess.uses}>
            <input
              type="number"
              min={1}
              max={MAX_CODE_USES}
              step={1}
              required
              value={uses}
              onChange={(event) => setUses(event.target.value)}
              className="ui-field-control px-3 py-2 text-sm"
              title={copy.nodeAccess.usesHelp}
            />
          </Field>
          <Field label={copy.nodeAccess.expiresIn}>
            <select
              value={expiry}
              onChange={(event) => setExpiry(Number(event.target.value))}
              className="ui-field-control px-3 py-2 text-sm"
            >
              {expiryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="submit"
            className="ui-button ui-button-primary"
            disabled={!usesValid || busy !== null}
          >
            {copy.nodeAccess.createLink}
          </button>
        </form>
      )}
    </NodeAccessSection>
  );
}

export function NodeRegistrationPanel({
  session,
}: {
  session: Session;
}): ReactElement {
  const action = useNodeAccessAction();
  const { busy, error, notice, run } = action;
  const [mode, setMode] = useState<NodeRegistrationModeViewModel | null>(null);
  const [codes, setCodes] = useState<NodeRegistrationCodeViewModel[]>([]);
  useEffect(() => {
    void run(
      'load',
      async () => {
        const [currentMode, currentCodes] = await Promise.all([
          applicationContainer.nodeAccess.getRegistrationMode(session),
          applicationContainer.nodeAccess.getRegistrationCodes(session),
        ]);

        setMode(currentMode);
        setCodes(currentCodes);
      },
      { failure: copy.nodeAccess.loadError },
    );
  }, [run, session]);

  const changeMode = (next: NodeRegistrationModeViewModel) => {
    if (next === mode || busy) return;

    void run(
      'mode',
      async () => {
        setMode(
          await applicationContainer.nodeAccess.changeRegistrationMode(
            next,
            session,
          ),
        );
      },
      { success: copy.nodeAccess.modeSaved },
    );
  };

  const revokeCode = (codeId: string) => {
    if (busy || !window.confirm(copy.nodeAccess.revokeConfirm)) return;

    void run(
      'revoke',
      async () => {
        await applicationContainer.nodeAccess.revokeRegistrationCode(
          codeId,
          session,
        );
        setCodes((current) => current.filter((code) => code.id !== codeId));
      },
      { success: copy.nodeAccess.revoked },
    );
  };

  return (
    <div
      className="grid content-start gap-6"
      data-testid="node-registration-panel"
    >
      <NodeAccessStatus error={error} notice={notice} />

      <NodeAccessSection
        body={copy.nodeAccess.registrationBody}
        title={copy.nodeAccess.registrationTitle}
      >
        {mode ? (
          <>
            <SegmentedControl
              columns={3}
              data-testid="node-registration-mode"
              onChange={changeMode}
              options={[
                { label: copy.nodeAccess.modeOpen, value: 'open' },
                { label: copy.nodeAccess.modeCodes, value: 'codes' },
                { label: copy.nodeAccess.modeClosed, value: 'closed' },
              ]}
              value={mode}
            />
            <p className="text-sm leading-6 text-white/55">{modeHelp[mode]}</p>
          </>
        ) : null}
      </NodeAccessSection>

      {mode === 'codes' && (
        <CreateRegistrationLink
          action={action}
          onIssued={setCodes}
          session={session}
        />
      )}

      {(mode === 'codes' || codes.length > 0) && (
        <NodeAccessSection title={copy.nodeAccess.codesTitle}>
          {codes.length === 0 ? (
            <NodeAccessEmpty text={copy.nodeAccess.codesEmpty} />
          ) : (
            <div>
              {codes.map((code) => (
                <RegistrationCodeRow
                  key={code.id}
                  code={code}
                  disabled={busy !== null}
                  onRevoke={() => revokeCode(code.id)}
                />
              ))}
            </div>
          )}
        </NodeAccessSection>
      )}
    </div>
  );
}
