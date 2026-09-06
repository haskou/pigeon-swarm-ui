import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LinkPreviewCard } from '../../../../../contexts/messages/presentation/components/LinkPreviewCard';
import { isIndependentClient } from '../../../../../shared/infrastructure/client/isIndependentClient';

jest.mock(
  '../../../../../shared/infrastructure/client/isIndependentClient',
  () => ({
    isIndependentClient: jest.fn(() => true),
  }),
);

describe(LinkPreviewCard.name, () => {
  it.each([true, false])(
    'renders remote images only in combined mode: independent=%s',
    (independent) => {
      jest.mocked(isIndependentClient).mockReturnValue(independent);
      const html = renderToStaticMarkup(
        createElement(LinkPreviewCard, {
          image: 'https://tracker.example/image.png',
          finalUrl: 'https://example.org/article',
          mine: false,
          title: 'Article title',
          url: 'https://example.org/article',
        }),
      );

      expect(html).toContain('href="https://example.org/article"');
      expect(html).toContain('Article title');

      if (independent) {
        expect(html).not.toContain('<img');
        expect(html).not.toContain('tracker.example');
        expect(html).not.toContain('favicon.ico');
      } else {
        expect(html).toContain('<img');
        expect(html).toContain('tracker.example/image.png');
        expect(html).toContain('example.org/favicon.ico');
      }
    },
  );
});
