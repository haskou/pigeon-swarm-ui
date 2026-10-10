import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
});
