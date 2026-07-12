import type {
  MyStickersResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

export interface GetMyStickersPort {
  getMyStickers(session: Session): Promise<MyStickersResource>;
}
