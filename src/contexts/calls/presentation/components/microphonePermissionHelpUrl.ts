/**
 * The vendor guide for allowing a site's microphone in the browser that sent
 * `userAgent`. Chromium browsers (Chrome, Edge, Brave, Opera) share Google's
 * guide; Safari's user agent is the one left without a Chromium or Firefox
 * token.
 */
export function microphonePermissionHelpUrl(userAgent: string): string {
  if (/Firefox\/|FxiOS\//.test(userAgent))
    return 'https://support.mozilla.org/kb/how-manage-your-camera-and-microphone-permissions';

  if (
    /Safari\//.test(userAgent) &&
    !/Chrome\/|Chromium\/|CriOS\/|Edg/.test(userAgent)
  )
    return 'https://support.apple.com/guide/safari/websites-ibrwe2159f50/mac';

  return 'https://support.google.com/chrome/answer/2693767';
}
