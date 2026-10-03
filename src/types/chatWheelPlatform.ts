/** Platform diagnostics for the optional ChatLane VPK converter. */
export type ChatWheelPlatform = 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'netbsd' | 'sunos' | 'aix' | 'android' | 'haiku' | 'unknown';

export type ChatWheelConverterStatus = {
    available: boolean;
    platform: ChatWheelPlatform;
    reason?: 'unsupported-platform' | 'missing-resource' | 'status-error';
    /** Present only when the converter is available. Never render this in UI. */
    path?: string;
};
