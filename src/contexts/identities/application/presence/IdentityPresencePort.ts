import type {
  IdentityPresence,
  SelectablePresenceStatus,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface IdentityPresencePort {
  get(session: Session, identityId: string): Promise<IdentityPresence>;
  getMany(session: Session, identityIds: string[]): Promise<IdentityPresence[]>;
  update(
    session: Session,
    status: SelectablePresenceStatus,
  ): Promise<IdentityPresence>;
}
