/** Platform diagnostics for the native ChatLane VPK converter. */
export type ChatWheelPlatform = 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'netbsd' | 'sunos' | 'aix' | 'android' | 'haiku' | 'unknown';

export type ChatWheelConverterStatus = {
    available: boolean;
    platform: ChatWheelPlatform;
    reason?: 'unsupported-platform' | 'missing-resource' | 'status-error';
};
