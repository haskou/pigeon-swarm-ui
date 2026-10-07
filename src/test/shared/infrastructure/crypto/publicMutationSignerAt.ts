import { PublicMutationSigner } from '../../../../shared/infrastructure/crypto/PublicMutationSigner';

/** Signer whose authorization revision source always answers `revision`. */
export function publicMutationSignerAt(revision = 0): PublicMutationSigner {
  return new PublicMutationSigner({ current: () => Promise.resolve(revision) });
}
