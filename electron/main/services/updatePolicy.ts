export function updateChannelPolicy(channel: unknown): { allowPrerelease: boolean; allowDowngrade: false } {
  return { allowPrerelease: channel === 'preview', allowDowngrade: false };
}
export function updateVersionAllowed(channel: unknown, version?: string): boolean {
  return updateChannelPolicy(channel).allowPrerelease || !version?.split('+')[0].includes('-');
}
