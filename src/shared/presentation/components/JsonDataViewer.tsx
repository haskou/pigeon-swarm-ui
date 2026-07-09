import { useMemo, useState, type ReactNode } from 'react';

import { copy } from '../i18n/copy';

export type JsonDataSection = {
  label: string;
  value: unknown;
};

export function JsonDataViewer({
  data,
  sections,
}: {
  data: unknown;
  sections?: JsonDataSection[];
}) {
  const [copied, setCopied] = useState(false);
  const resolvedSections = useMemo(
    () => sections ?? classifyDataSections(data),
    [data, sections],
  );
  const serialized = useMemo(() => safeJsonStringify(data), [data]);

  const copyJson = async () => {
    if (!navigator.clipboard) return;

    await navigator.clipboard.writeText(serialized);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div data-testid="json-data-viewer">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-white/50">
          {copy.dataViewer.description}
        </p>
        <button
          type="button"
          onClick={() => void copyJson()}
          className="ui-button shrink-0"
        >
          {copied ? copy.dataViewer.copied : copy.dataViewer.copyJson}
        </button>
      </div>

      <div className="divide-y divide-white/10 border-y border-white/10">
        {resolvedSections.map((section) => (
          <section className="py-4" key={section.label}>
            <h3 className="mb-3 text-sm font-bold text-white/80">
              {section.label}
            </h3>
            <div className="overflow-x-auto rounded-md border border-white/[0.07] bg-black/25 p-3 font-mono text-xs leading-5">
              <JsonTree value={section.value} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function JsonTree({ value }: { value: unknown }) {
  return <JsonValue depth={0} value={value} />;
}

function JsonValue({ depth, value }: { depth: number; value: unknown }) {
  if (value === null) {
    return <span className="text-fuchsia-200/75">null</span>;
  }

  if (Array.isArray(value)) {
    return (
      <details open={depth < 2}>
        <summary className="cursor-pointer select-none text-white/45">
          {copy.dataViewer.array.replace('{count}', String(value.length))}
        </summary>
        <div className="ml-2 mt-1 border-l border-white/10 pl-3">
          {value.map((item, index) => (
            <JsonProperty
              key={index}
              name={String(index)}
              value={item}
              depth={depth}
            />
          ))}
        </div>
      </details>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    return (
      <details open={depth < 2}>
        <summary className="cursor-pointer select-none text-white/45">
          {copy.dataViewer.object.replace('{count}', String(entries.length))}
        </summary>
        <div className="ml-2 mt-1 border-l border-white/10 pl-3">
          {entries.map(([name, child]) => (
            <JsonProperty key={name} name={name} value={child} depth={depth} />
          ))}
        </div>
      </details>
    );
  }

  return <JsonPrimitive value={value} />;
}

function JsonProperty({
  depth,
  name,
  value,
}: {
  depth: number;
  name: string;
  value: unknown;
}) {
  const complex = typeof value === 'object' && value !== null;

  return (
    <div className={complex ? 'py-1' : 'flex min-w-max gap-2 py-0.5'}>
      <span className="text-cyan-200/80">{name}</span>
      <span className="text-white/30">:</span>
      {complex ? (
        <div className="mt-1">
          <JsonValue depth={depth + 1} value={value} />
        </div>
      ) : (
        <JsonPrimitive value={value} />
      )}
    </div>
  );
}

function JsonPrimitive({ value }: { value: unknown }): ReactNode {
  if (typeof value === 'string') {
    return <span className="text-emerald-200/80">&quot;{value}&quot;</span>;
  }

  if (typeof value === 'number') {
    return <span className="text-amber-200/80">{String(value)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-violet-200/80">{String(value)}</span>;
  }

  if (typeof value === 'undefined') {
    return <span className="text-white/35">undefined</span>;
  }

  return <span className="text-white/60">{String(value)}</span>;
}

function classifyDataSections(data: unknown): JsonDataSection[] {
  if (!isRecord(data)) {
    return [{ label: copy.dataViewer.received, value: data }];
  }

  const received: Record<string, unknown> = {};
  const decrypted: Record<string, unknown> = {};
  const derived: Record<string, unknown> = {};
  const additional: Record<string, unknown> = {};

  Object.entries(data).forEach(([key, value]) => {
    const normalized = key.toLowerCase();

    if (normalized.startsWith('server') || normalized === 'raw') {
      received[key] = value;
    } else if (
      normalized.includes('decrypted') ||
      normalized.includes('plaintext')
    ) {
      decrypted[key] = value;
    } else if (
      normalized.includes('derived') ||
      normalized.includes('frontend')
    ) {
      derived[key] = value;
    } else {
      additional[key] = value;
    }
  });

  const sections: JsonDataSection[] = [];

  appendSection(sections, copy.dataViewer.received, received);
  appendSection(sections, copy.dataViewer.decrypted, decrypted);
  appendSection(sections, copy.dataViewer.derived, derived);
  appendSection(sections, copy.dataViewer.additional, additional);

  return sections.length > 0
    ? sections
    : [{ label: copy.dataViewer.received, value: data }];
}

function appendSection(
  sections: JsonDataSection[],
  label: string,
  value: Record<string, unknown>,
) {
  if (Object.keys(value).length > 0) sections.push({ label, value });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
}
