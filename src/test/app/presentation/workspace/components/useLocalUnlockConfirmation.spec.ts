import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { LocalUnlockConfirmation } from '../../../../../app/presentation/workspace/components/useLocalUnlockConfirmation';

import { applicationContainer } from '../../../../../app/composition/applicationContainer';
import { useLocalUnlockConfirmation } from '../../../../../app/presentation/workspace/components/useLocalUnlockConfirmation';

type MockEffect = () => void | (() => void);

const mockEffects: MockEffect[] = [];
const mockStates: unknown[] = [];
const mockRender = { index: 0 };

jest.mock('react', () => ({
  useEffect: (effect: MockEffect) => {
    mockEffects.push(effect);
  },
  useState: (initial: unknown) => {
    const index = mockRender.index;

    mockRender.index = index + 1;

    if (!(index in mockStates)) mockStates[index] = initial;

    return [
      mockStates[index],
      (next: unknown) => {
        mockStates[index] = next;
      },
    ];
  },
}));
jest.mock('../../../../../app/composition/applicationContainer', () => ({
  applicationContainer: {
    identities: { localUnlockMethod: jest.fn() },
  },
}));

const identities = jest.mocked(applicationContainer.identities);

function render(): LocalUnlockConfirmation {
  mockRender.index = 0;

  return useLocalUnlockConfirmation('identity-1');
}

async function mount(): Promise<void> {
  render();
  mockEffects.forEach((effect) => effect());
  await Promise.resolve();
  await Promise.resolve();
}

describe(useLocalUnlockConfirmation.name, () => {
  beforeEach(() => {
    mockEffects.length = 0;
    mockStates.length = 0;
    identities.localUnlockMethod.mockReset();
  });

  it('asks for the password and hands it over once, clearing the field', async () => {
    identities.localUnlockMethod.mockResolvedValue('password');
    await mount();

    expect(render()).toMatchObject({ ready: false, usesPassword: true });

    render().onPasswordChange('device password');

    expect(render().ready).toBe(true);
    expect(render().consume()).toBe('device password');
    expect(render()).toMatchObject({ password: '', ready: false });
    expect(identities.localUnlockMethod).toHaveBeenCalledWith('identity-1');
  });

  it('leaves the confirmation to the passkey when one unlocks this device', async () => {
    identities.localUnlockMethod.mockResolvedValue('passkey');
    await mount();

    expect(render()).toMatchObject({ ready: true, usesPassword: false });
    expect(render().consume()).toBeUndefined();
  });

  it('keeps asking for the password when the unlock method cannot be read', async () => {
    identities.localUnlockMethod.mockRejectedValue(new Error('unreadable'));
    await mount();

    expect(render()).toMatchObject({ ready: false, usesPassword: true });
  });
});
