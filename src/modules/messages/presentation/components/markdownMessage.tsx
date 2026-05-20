import type { ReactNode } from 'react';

import { cx } from '../../../../shared/presentation/classNameHelper';

type InlineToken =
  | { children: InlineToken[]; type: 'bold' | 'italic' | 'strike' }
  | { text: string; type: 'code' | 'text' }
  | { text: string; type: 'link'; url: string }
  | { identityId?: string; text: string; type: 'mention' };

type MarkdownBlock =
  | { children: InlineToken[]; type: 'paragraph' | 'quote' }
  | { children: InlineToken[]; level: 1 | 2 | 3; type: 'heading' }
  | { code: string; type: 'code' }
  | { items: InlineToken[][]; ordered: boolean; type: 'list' };

const autoLinkPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const markdownLinkPattern =
  /^\[([^\]]+)\]\((https?:\/\/[^)\s]+|www\.[^)\s]+)\)/;

export type MarkdownMention = {
  identityId?: string;
  token: string;
};

export function MarkdownMessage({
  content,
  mentions = [],
  mine,
  onMentionClick,
}: {
  content: string;
  mentions?: MarkdownMention[];
  mine: boolean;
  onMentionClick?: (identityId: string, target: HTMLElement) => void;
}) {
  if (!hasMarkdownSyntax(content)) {
    return (
      <>
        {renderInline(parseInline(content, mentions), mine, 'plain', onMentionClick)}
      </>
    );
  }

  return (
    <div className="space-y-2">
      {parseMarkdownBlocks(content, mentions).map((block, index) =>
        renderBlock(block, mine, index, onMentionClick),
      )}
    </div>
  );
}

function hasMarkdownSyntax(content: string): boolean {
  return (
    /(^|\n)(#{1,3}\s|>\s|[-*]\s|\d+\.\s|```)/.test(content) ||
    /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\((https?:\/\/|www\.))/i.test(
      content,
    )
  );
}

function parseMarkdownBlocks(
  content: string,
  mentions: MarkdownMention[] = [],
): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      pushParagraph(blocks, paragraph, mentions);
      paragraph = [];
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      pushParagraph(blocks, paragraph, mentions);
      paragraph = [];
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ code: codeLines.join('\n'), type: 'code' });
      index += index < lines.length ? 1 : 0;
      continue;
    }

    const heading = headingBlock(line, mentions);

    if (heading) {
      pushParagraph(blocks, paragraph, mentions);
      paragraph = [];
      blocks.push(heading);
      index += 1;
      continue;
    }

    const list = listBlock(lines, index, mentions);

    if (list) {
      pushParagraph(blocks, paragraph, mentions);
      paragraph = [];
      blocks.push(list.block);
      index = list.nextIndex;
      continue;
    }

    const quote = quoteBlock(line, mentions);

    if (quote) {
      pushParagraph(blocks, paragraph, mentions);
      paragraph = [];
      blocks.push(quote);
      index += 1;
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  pushParagraph(blocks, paragraph, mentions);

  return blocks;
}

function pushParagraph(
  blocks: MarkdownBlock[],
  lines: string[],
  mentions: MarkdownMention[],
): void {
  const text = lines.join('\n').trim();

  if (text)
    blocks.push({ children: parseInline(text, mentions), type: 'paragraph' });
}

function headingBlock(
  line: string,
  mentions: MarkdownMention[],
): MarkdownBlock | null {
  const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());

  if (!match) return null;

  return {
    children: parseInline(match[2], mentions),
    level: Math.min(match[1].length, 3) as 1 | 2 | 3,
    type: 'heading',
  };
}

function quoteBlock(
  line: string,
  mentions: MarkdownMention[],
): MarkdownBlock | null {
  const match = /^>\s+(.+)$/.exec(line.trim());

  return match
    ? { children: parseInline(match[1], mentions), type: 'quote' }
    : null;
}

function listBlock(
  lines: string[],
  startIndex: number,
  mentions: MarkdownMention[],
): { block: MarkdownBlock; nextIndex: number } | null {
  const first = listLine(lines[startIndex]);

  if (!first) return null;

  const items: InlineToken[][] = [];
  let index = startIndex;

  while (index < lines.length) {
    const item = listLine(lines[index]);

    if (!item || item.ordered !== first.ordered) break;

    items.push(parseInline(item.text, mentions));
    index += 1;
  }

  return {
    block: { items, ordered: first.ordered, type: 'list' },
    nextIndex: index,
  };
}

function listLine(line: string): { ordered: boolean; text: string } | null {
  const unordered = /^[-*]\s+(.+)$/.exec(line.trim());

  if (unordered) return { ordered: false, text: unordered[1] };

  const ordered = /^\d+\.\s+(.+)$/.exec(line.trim());

  return ordered ? { ordered: true, text: ordered[1] } : null;
}

function parseInline(
  text: string,
  mentions: MarkdownMention[] = [],
): InlineToken[] {
  return parseInlineSegment(text, 0, text.length, mentions);
}

function parseInlineSegment(
  text: string,
  start: number,
  end: number,
  mentions: MarkdownMention[],
): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = start;

  while (cursor < end) {
    const markdownLink = markdownLinkPattern.exec(text.slice(cursor, end));

    if (markdownLink) {
      tokens.push({
        text: markdownLink[1],
        type: 'link',
        url: normalizeUrl(markdownLink[2]),
      });
      cursor += markdownLink[0].length;
      continue;
    }

    const delimiter = nextInlineDelimiter(text, cursor, end);

    if (!delimiter) {
      pushTextWithAutoLinks(tokens, text.slice(cursor, end), mentions);
      break;
    }

    if (delimiter.index > cursor) {
      pushTextWithAutoLinks(
        tokens,
        text.slice(cursor, delimiter.index),
        mentions,
      );
    }

    const closeIndex = text.indexOf(
      delimiter.close,
      delimiter.index + delimiter.open.length,
    );

    if (closeIndex === -1 || closeIndex >= end) {
      pushTextWithAutoLinks(tokens, delimiter.open, mentions);
      cursor = delimiter.index + delimiter.open.length;
      continue;
    }

    const innerStart = delimiter.index + delimiter.open.length;
    const innerText = text.slice(innerStart, closeIndex);

    if (!innerText.trim()) {
      pushTextWithAutoLinks(
        tokens,
        text.slice(delimiter.index, closeIndex + delimiter.close.length),
        mentions,
      );
      cursor = closeIndex + delimiter.close.length;
      continue;
    }

    tokens.push(
      delimiter.type === 'code'
        ? { text: innerText, type: 'code' }
        : {
            children: parseInlineSegment(text, innerStart, closeIndex, mentions),
            type: delimiter.type,
          },
    );
    cursor = closeIndex + delimiter.close.length;
  }

  return tokens;
}

function nextInlineDelimiter(text: string, start: number, end: number) {
  const delimiters = [
    { close: '**', open: '**', type: 'bold' as const },
    { close: '__', open: '__', type: 'bold' as const },
    { close: '~~', open: '~~', type: 'strike' as const },
    { close: '`', open: '`', type: 'code' as const },
    { close: '*', open: '*', type: 'italic' as const },
    { close: '_', open: '_', type: 'italic' as const },
  ];

  return delimiters
    .map((delimiter) => ({
      ...delimiter,
      index: text.indexOf(delimiter.open, start),
    }))
    .filter((delimiter) => delimiter.index >= 0 && delimiter.index < end)
    .sort((left, right) => left.index - right.index)[0];
}

function pushTextWithAutoLinks(
  tokens: InlineToken[],
  text: string,
  mentions: MarkdownMention[],
): void {
  autoLinkPattern.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = autoLinkPattern.exec(text))) {
    if (match.index > cursor) {
      pushTextWithMentions(
        tokens,
        text.slice(cursor, match.index),
        mentions,
      );
    }

    tokens.push({
      text: match[0],
      type: 'link',
      url: normalizeUrl(match[0]),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    pushTextWithMentions(tokens, text.slice(cursor), mentions);
  }
}

function pushTextWithMentions(
  tokens: InlineToken[],
  text: string,
  mentions: MarkdownMention[],
): void {
  const pattern = mentionPattern(mentions);

  if (!pattern) {
    tokens.push({ text, type: 'text' });

    return;
  }

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) {
      tokens.push({ text: text.slice(cursor, match.index), type: 'text' });
    }

    const mention = mentions.find(
      (candidate) => candidate.token.toLowerCase() === match![0].toLowerCase(),
    );

    tokens.push({
      identityId: mention?.identityId,
      text: match[0],
      type: 'mention',
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    tokens.push({ text: text.slice(cursor), type: 'text' });
  }
}

function renderBlock(
  block: MarkdownBlock,
  mine: boolean,
  index: number,
  onMentionClick?: (identityId: string, target: HTMLElement) => void,
) {
  switch (block.type) {
    case 'heading':
      return (
        <h3
          key={index}
          className={cx(
            'font-black leading-snug',
            block.level === 1 && 'text-base',
            block.level === 2 && 'text-sm',
            block.level === 3 && 'text-xs uppercase text-white/75',
          )}
        >
          {renderInline(block.children, mine, `${index}`, onMentionClick)}
        </h3>
      );
    case 'quote':
      return (
        <blockquote
          key={index}
          className="border-l-2 border-white/35 pl-3 text-white/75"
        >
          {renderInline(block.children, mine, `${index}`, onMentionClick)}
        </blockquote>
      );
    case 'code':
      return (
        <pre
          key={index}
          className="overflow-x-auto rounded-2xl bg-black/35 p-3 text-xs leading-5 text-white/80"
        >
          <code>{block.code}</code>
        </pre>
      );
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';

      return (
        <ListTag
          key={index}
          className={cx(
            'space-y-1 pl-5',
            block.ordered ? 'list-decimal' : 'list-disc',
          )}
        >
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              {renderInline(item, mine, `${index}-${itemIndex}`, onMentionClick)}
            </li>
          ))}
        </ListTag>
      );
    }
    case 'paragraph':
      return (
        <p key={index} className="whitespace-pre-wrap">
          {renderInline(block.children, mine, `${index}`, onMentionClick)}
        </p>
      );
  }
}

function renderInline(
  tokens: InlineToken[],
  mine: boolean,
  keyPrefix: string,
  onMentionClick?: (identityId: string, target: HTMLElement) => void,
): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (token.type) {
      case 'bold':
        return (
          <strong key={key}>
            {renderInline(token.children, mine, key, onMentionClick)}
          </strong>
        );
      case 'italic':
        return (
          <em key={key}>
            {renderInline(token.children, mine, key, onMentionClick)}
          </em>
        );
      case 'strike':
        return (
          <s key={key}>
            {renderInline(token.children, mine, key, onMentionClick)}
          </s>
        );
      case 'code':
        return (
          <code
            key={key}
            className="rounded-md bg-black/25 px-1 py-0.5 text-[0.92em]"
          >
            {token.text}
          </code>
        );
      case 'link':
        return (
          <a
            key={key}
            href={token.url}
            target="_blank"
            rel="noreferrer"
            className={cx(
              'font-bold underline decoration-2 underline-offset-2',
              mine
                ? 'text-white decoration-white/50'
                : 'text-cyan-200 decoration-cyan-200/50',
            )}
          >
            {token.text}
          </a>
        );
      case 'mention':
        return (
          <button
            key={key}
            type="button"
            onClick={(event) => {
              if (!token.identityId) return;

              onMentionClick?.(token.identityId, event.currentTarget);
            }}
            className="rounded-md bg-fuchsia-400/20 px-1 font-black text-fuchsia-100 transition hover:bg-fuchsia-400/30"
          >
            {token.text}
          </button>
        );
      case 'text':
        return token.text;
    }
  });
}

function mentionPattern(mentions: MarkdownMention[]): RegExp | null {
  const tokens = Array.from(
    new Set(mentions.map((mention) => mention.token).filter(Boolean)),
  ).sort((left, right) => right.length - left.length);

  if (tokens.length === 0) return null;

  return new RegExp(tokens.map(escapeRegExp).join('|'), 'gi');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUrl(value: string): string {
  return value.startsWith('www.') ? `https://${value}` : value;
}
