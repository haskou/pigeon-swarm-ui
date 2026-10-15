import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CallMicrophoneErrorCode } from '../../../../../contexts/calls/presentation/view-models/CallMicrophoneErrorCode';
import type { CallSession } from '../../../../../contexts/calls/presentation/view-models/CallSession';

import { MicrophoneBlockedNotice } from '../../../../../contexts/calls/presentation/components/MicrophoneBlockedNotice';
import { copy } from '../../../../../shared/presentation/i18n/copy';

const userAgents = {
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  firefox:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0',
  safari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
};

function render(
  microphoneError: CallMicrophoneErrorCode,
  userAgent = userAgents.chrome,
): string {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent },
  });

  return renderToStaticMarkup(
    createElement(MicrophoneBlockedNotice, {
      call: {
        hasMicrophone: false,
        microphoneError,
      } as CallSession,
      onRetryMicrophone: jest.fn(),
    }),
  );
}

function buttons(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(
    ([, label]) => label,
  );
}

function helpLink(html: string): string | undefined {
  return /<a href="([^"]+)"/.exec(html)?.[1];
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'navigator');
});

describe(MicrophoneBlockedNotice.name, () => {
  it('offers one way to allow a denied microphone and the help of this browser', () => {
    expect(buttons(render('denied'))).toEqual([copy.calls.microphoneAllow]);
    expect(helpLink(render('denied', userAgents.chrome))).toBe(
      'https://support.google.com/chrome/answer/2693767',
    );
    expect(helpLink(render('denied', userAgents.edge))).toBe(
      'https://support.google.com/chrome/answer/2693767',
    );
    expect(helpLink(render('denied', userAgents.firefox))).toBe(
      'https://support.mozilla.org/kb/how-manage-your-camera-and-microphone-permissions',
    );
    expect(helpLink(render('denied', userAgents.safari))).toBe(
      'https://support.apple.com/guide/safari/websites-ibrwe2159f50/mac',
    );
  });

  it.each<CallMicrophoneErrorCode>([
    'missing-device',
    'in-use',
    'constraint',
    'security',
    'unknown',
  ])('offers only a retry for %s, which no permission fixes', (error) => {
    const html = render(error);

    expect(buttons(html)).toEqual([copy.calls.microphoneRetry]);
    expect(helpLink(html)).toBeUndefined();
  });

  it.each<CallMicrophoneErrorCode>(['not-secure', 'unsupported'])(
    'offers no action that cannot work for %s',
    (error) => {
      const html = render(error);

      expect(buttons(html)).toEqual([]);
      expect(helpLink(html)).toBeUndefined();
    },
  );

  it('names a missing microphone instead of a permission problem', () => {
    const html = render('missing-device');

    expect(html).toContain(copy.calls.microphoneMissingDevice);
    expect(html).not.toContain(copy.calls.microphoneTroubleshooting);
  });
});
