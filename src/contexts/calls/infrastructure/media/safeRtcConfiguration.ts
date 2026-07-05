import { logCallWarning } from './callDebugLogger';

function iceServerUrls(server: RTCIceServer): string[] {
  if (Array.isArray(server.urls)) return server.urls;

  return [server.urls];
}

function isTurnUrl(url: string): boolean {
  const normalizedUrl = url.toLowerCase();

  return (
    normalizedUrl.startsWith('turn:') || normalizedUrl.startsWith('turns:')
  );
}

function hasTurnCredentials(server: RTCIceServer): boolean {
  return Boolean(server.username && server.credential);
}

function rtcIceServerWithUrls(
  server: RTCIceServer,
  urls: string[],
): RTCIceServer {
  return {
    ...server,
    urls: urls.length === 1 ? urls[0] : urls,
  };
}

export function safeRtcConfiguration(
  configuration: RTCConfiguration,
): RTCConfiguration {
  const iceServers = (configuration.iceServers ?? [])
    .map((server) => {
      const validUrls = iceServerUrls(server).filter((url) => {
        if (!isTurnUrl(url)) return true;

        if (hasTurnCredentials(server)) return true;

        logCallWarning(
          'peer-manager:ice-server:drop-turn-without-credentials',
          {
            url,
          },
        );

        return false;
      });

      if (validUrls.length === 0) return null;

      return rtcIceServerWithUrls(server, validUrls);
    })
    .filter((server): server is RTCIceServer => Boolean(server));
  const hasRelayServer = iceServers.some((server) =>
    iceServerUrls(server).some(isTurnUrl),
  );
  const iceTransportPolicy =
    configuration.iceTransportPolicy === 'relay' && !hasRelayServer
      ? 'all'
      : configuration.iceTransportPolicy;

  if (configuration.iceTransportPolicy === 'relay' && !hasRelayServer) {
    logCallWarning('peer-manager:ice-policy:fallback-without-valid-relay');
  }

  return {
    ...configuration,
    iceServers,
    iceTransportPolicy,
  };
}
