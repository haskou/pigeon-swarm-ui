import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { CommunityMembershipRequest, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';

type MembershipRequestAction = 'accept' | 'decline' | 'refresh';

type UseCommunityMembershipRequestsInput = {
  onCommunitiesReload: () => Promise<void>;
  session: Session;
};

export function useCommunityMembershipRequests({
  onCommunitiesReload,
  session,
}: UseCommunityMembershipRequestsInput): {
  accept: (requestId: string) => Promise<void>;
  action: MembershipRequestAction | null;
  decline: (requestId: string) => Promise<void>;
  error: string | null;
  pendingCount: number;
  refresh: () => Promise<void>;
  requests: CommunityMembershipRequest[];
  setRequests: Dispatch<SetStateAction<CommunityMembershipRequest[]>>;
} {
  const [requests, setRequests] = useState<CommunityMembershipRequest[]>([]);
  const [action, setAction] = useState<MembershipRequestAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refresh = useCallback(async () => {
    const currentSession = sessionRef.current;

    setAction('refresh');
    setError(null);
    try {
      setRequests(
        await pigeonApplication.listCommunityMembershipRequests(
          currentSession,
        ),
      );
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.membershipError));
    }
    setAction(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, session.identity.id]);

  const update = useCallback(
    async (requestId: string, status: 'accepted' | 'declined') => {
      const currentSession = sessionRef.current;

      setAction(status === 'accepted' ? 'accept' : 'decline');
      setError(null);
      try {
        const updated =
          await pigeonApplication.updateCommunityMembershipRequest(
            currentSession,
            requestId,
            status,
          );

        setRequests((current) =>
          current.map((request) =>
            request.id === updated.id ? updated : request,
          ),
        );

        if (status === 'accepted') {
          await onCommunitiesReload();
        }
      } catch (caught) {
        setError(toUserErrorMessage(caught, copy.communities.membershipError));
      }
      setAction(null);
    },
    [onCommunitiesReload],
  );

  const pendingCount = requests.filter(
    (request) => request.status === 'pending',
  ).length;

  return {
    accept: (requestId) => update(requestId, 'accepted'),
    action,
    decline: (requestId) => update(requestId, 'declined'),
    error,
    pendingCount,
    refresh,
    requests,
    setRequests,
  };
}
