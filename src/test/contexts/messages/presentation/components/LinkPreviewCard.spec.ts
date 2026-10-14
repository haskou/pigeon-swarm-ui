import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { MessageLinkPreview } from '../../../../../contexts/messages/infrastructure/http/resources/MessageLinkPreview';

import { LinkPreviewCard } from '../../../../../contexts/messages/presentation/components/LinkPreviewCard';

function render(preview: MessageLinkPreview): string {
  return renderToStaticMarkup(
    createElement(LinkPreviewCard, { ...preview, mine: false }),
  );
}

describe(LinkPreviewCard.name, () => {
  it('never loads a sender-chosen image or the site favicon', () => {
    const html = render({
      finalUrl: 'https://example.org/article',
      image: 'https://tracker.example/image.png',
      title: 'Article title',
      url: 'https://example.org/article',
    });

    expect(html).toContain('href="https://example.org/article"');
    expect(html).toContain('Article title');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('tracker.example');
    expect(html).not.toContain('favicon.ico');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'not a url',
  ])('renders nothing for a %s target', (target) => {
    expect(render({ finalUrl: target, url: target })).toBe('');
  });

  it('escapes markup in the preview text', () => {
    const html = render({
      description: '<img src=x onerror=alert(1)>',
      finalUrl: 'https://example.org',
      siteName: '<script>alert(1)</script>',
      title: '<b>title</b>',
      url: 'https://example.org',
    });

    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img');
  });
});
