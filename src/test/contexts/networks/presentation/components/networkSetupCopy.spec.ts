import {
  networkSetupBody,
  networkSetupSubmitLabel,
} from '../../../../../contexts/networks/presentation/components/networkSetupCopy';
import { copy } from '../../../../../shared/presentation/i18n/copy';

describe('network setup copy', () => {
  it.each([
    ['create', copy.network.createBody, copy.network.createSubmit],
    ['join', copy.network.joinBody, copy.network.joinSubmit],
    ['public', copy.network.publicBody, copy.network.publicSubmit],
  ] as const)('selects copy for %s mode', (mode, body, submitLabel) => {
    expect(networkSetupBody(mode)).toBe(body);
    expect(networkSetupSubmitLabel(mode, false)).toBe(submitLabel);
  });

  it('uses the loading label independently of the selected mode', () => {
    expect(networkSetupSubmitLabel('join', true)).toBe(
      copy.network.loadingSubmit,
    );
  });
});
