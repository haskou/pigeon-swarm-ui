import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MESSAGE_CONTENT_MAX_LENGTH } from '../../../../../contexts/messages/domain/MESSAGE_CONTENT_MAX_LENGTH';
import { MarkdownMessage } from '../../../../../contexts/messages/presentation/components/markdownMessage';

function render(content: string): string {
  return renderToStaticMarkup(
    createElement(MarkdownMessage, { content, mine: false }),
  );
}

describe(MarkdownMessage.name, () => {
  it('links only http, https and www targets', () => {
    expect(render('[docs](https://example.org/docs)')).toContain(
      'href="https://example.org/docs"',
    );
    expect(render('see www.example.org')).toContain(
      'href="https://www.example.org"',
    );
  });

  it.each([
    '[click](javascript:alert(1))',
    'javascript:alert(1)',
    '[frame](data:text/html,<script>alert(1)</script>)',
    'data:text/html,<script>alert(1)</script>',
    '[legacy](vbscript:msgbox(1))',
  ])('never turns %s into an anchor', (content) => {
    expect(render(content)).not.toContain('<a ');
  });

  it('escapes raw HTML instead of emitting elements', () => {
    const html = render('<img src=x onerror=alert(1)>');

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('formats content up to the message length limit', () => {
    const content = `**bold** ${'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH - 9)}`;

    expect(render(content)).toContain('<strong');
  });

  it('shows content beyond the message length limit as plain text', () => {
    const html = render(
      `**bold** see https://example.org ${'a'.repeat(MESSAGE_CONTENT_MAX_LENGTH)}`,
    );

    expect(html).not.toContain('<strong');
    expect(html).toContain('**bold** see ');
    expect(html).toContain('href="https://example.org"');
  });

  it('renders a flood of unmatched delimiters from another client quickly', () => {
    const startedAt = performance.now();

    render('*_~`['.repeat(20_000));

    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });

  it('renders many links and mentions from another client quickly', () => {
    const mentions = Array.from({ length: 5_000 }, (_, index) => ({
      identityId: `identity-${index}`,
      token: `@member${index}`,
    }));
    const startedAt = performance.now();

    const html = renderToStaticMarkup(
      createElement(MarkdownMessage, {
        content: 'https://a.example @member4999 '.repeat(4_000),
        mentions,
        mine: false,
      }),
    );

    expect(performance.now() - startedAt).toBeLessThan(1_000);
    expect(html).toContain('@member4999');
  });
});
