import type { HttpJsonClient } from '../../../../shared/infrastructure/http/HttpJsonClient';
import type { RequestSigner } from '../../../../shared/infrastructure/http/RequestSigner';
import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../identities/domain/DeviceAuthorizationTransitionLogPrimitives';
import type { Session } from '../../../identities/infrastructure/session/Session';

import { pagedPath } from '../../../../shared/infrastructure/http/pagedPath';
import { readAllPages } from '../../../../shared/infrastructure/http/readAllPages';

export type DeviceSealingRecordRequest = {
  deviceCredential: string;
  sealingPublicKey: string;
  signature: string;
  utcDay: string;
};

export type SealingViewResource = {
  devices: {
    deviceCredential: string;
    sealingKeys: { sealingPublicKey: string; utcDay: string }[];
  }[];
  identityId: string;
  revision: number;
};

type TransitionPage = DeviceAuthorizationTransitionLogPrimitives & {
  nextCursor: null | string;
};

/**
 * The only client of the sealing routes: publishing a device's record, the
 * public sealing view, and the transition log a verifier walks. A route
 * change is an edit of this file.
 */
export class PigeonCallSealingApi {
  public constructor(
    private readonly http: HttpJsonClient,
    private readonly signer: RequestSigner,
  ) {}

  private static base(identityId: string): string {
    return `/identity-devices/${encodeURIComponent(identityId)}`;
  }

  public async publishRecord(
    session: Session,
    record: DeviceSealingRecordRequest,
  ): Promise<void> {
    const path = `${PigeonCallSealingApi.base(session.identity.id)}/sealing-records`;

    await this.http.request<unknown>(path, {
      body: JSON.stringify(record),
      headers: await this.signer.headers(session, 'PUT', path, record),
      method: 'PUT',
    });
  }

  public async sealingView(identityId: string): Promise<SealingViewResource> {
    return await this.http.request<SealingViewResource>(
      `${PigeonCallSealingApi.base(identityId)}/sealing-view`,
    );
  }

  /** Every page of the identity's transition log, merged. */
  public async transitions(
    session: Session,
    identityId: string,
  ): Promise<DeviceAuthorizationTransitionLogPrimitives> {
    const base = `${PigeonCallSealingApi.base(identityId)}/transitions`;
    const pages = await readAllPages(async (cursor) => {
      const path = pagedPath(base, cursor);

      return await this.http.request<TransitionPage>(path, {
        headers: await this.signer.headers(session, 'GET', path),
        method: 'GET',
      });
    });
    const [first] = pages;

    return {
      concurrentRecoveries: pages.flatMap((page) => page.concurrentRecoveries),
      identityId: first.identityId,
      recoveries: pages.flatMap((page) => page.recoveries),
      transitions: pages.flatMap((page) => page.transitions),
    };
  }
}
