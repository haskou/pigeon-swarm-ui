export type RememberedIdentityPreview = {
  identityId: string;
  name: string;
  pictureUrl?: null | string;
};

const REMEMBERED_IDENTITY_PREVIEW_KEY = 'pigeon-swarm-identity-preview';

export function loadRememberedIdentityPreview(
  identityId: string,
): RememberedIdentityPreview | null {
  const storedPreview = localStorage.getItem(REMEMBERED_IDENTITY_PREVIEW_KEY);

  if (!storedPreview) return null;

  try {
    const parsed = JSON.parse(
      storedPreview,
    ) as Partial<RememberedIdentityPreview>;

    if (
      parsed.identityId !== identityId ||
      !parsed.name ||
      typeof parsed.name !== 'string'
    ) {
      return null;
    }

    return {
      identityId,
      name: parsed.name,
      pictureUrl:
        typeof parsed.pictureUrl === 'string' ? parsed.pictureUrl : null,
    };
  } catch {
    localStorage.removeItem(REMEMBERED_IDENTITY_PREVIEW_KEY);

    return null;
  }
}

export function saveRememberedIdentityPreview(
  preview: RememberedIdentityPreview,
): void {
  localStorage.setItem(
    REMEMBERED_IDENTITY_PREVIEW_KEY,
    JSON.stringify(preview),
  );
}
