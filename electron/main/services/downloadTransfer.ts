import { promises as fs, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { writeRecoveryJson, assertRecoveryPath } from './recoveryBackup';
import type { FileHandle } from 'fs/promises';
import http, { type Agent, type IncomingHttpHeaders, type IncomingMessage } from 'http';
import https from 'https';
import { finished } from 'stream/promises';
import { describeNetworkError } from './networkErrors';
import { isAllowedGameBananaDownloadHostname } from './security';

export type DownloadServerStatus =
    | { phase: 'selected'; server: string }
    | { phase: 'switching'; server: string; previousServer: string };

export interface DownloadTransferOptions {
    candidateUrls: readonly string[];
    destinationPath: string;
    onProgress: (downloaded: number, total: number) => void;
    onResponseFilename?: (filename: string) => void;
    connectionTimeoutMs?: number;
    mirrorConnectionTimeoutMs?: number;
    stallTimeoutMs?: number;
    signal?: AbortSignal;
    pauseSignal?: AbortSignal;
    checkpoint?: DownloadTransferCheckpoint;
    resolveRedirectCandidates?: (redirectUrl: string, signal?: AbortSignal) => Promise<readonly string[] | undefined>;
    onServerStatus?: (status: DownloadServerStatus) => void;
    agent?: Agent;
    /**
     * Opt-in durable checkpoint on disk: the partial survives a restart and is
     * resumed only when its prefix hash and server validator still match.
     * Callers without this keep the in-memory-only contract.
     */
    resumeMetadataPath?: string;
    resumeIdentity?: string;
    /** Extra passes over the candidate list (max 3), with a short backoff. */
    retryCount?: number;
    onRetry?: (attempt: number) => void;
}

const DEFAULT_MIRROR_CONNECTION_TIMEOUT_MS = 10_000;

type Validator = { header: 'ETag' | 'Last-Modified'; value: string };

async function prefixHash(path: string, bytes: number) {
    const hash = createHash('sha256');
    if (bytes > 0) for await (const chunk of createReadStream(path, { start: 0, end: bytes - 1 })) hash.update(chunk);
    return hash;
}

/** Retained only by one queued job, alongside its partial archive. */
export interface DownloadTransferCheckpoint {
    total?: number;
    validator?: Validator;
    candidateUrl?: string;
    candidateUrls?: readonly string[];
    destinationPath?: string;
}

/** The in-memory checkpoint plus the fields persisted to `resumeMetadataPath`. */
type TransferState = DownloadTransferCheckpoint & {
    bytes?: number;
    sha256?: string;
    urls?: string[];
    identity?: string;
};

type PersistProgress = (bytes: number, sha256: string) => Promise<void>;

export class DownloadSuspendedError extends Error {
    constructor() {
        super('DOWNLOAD_SUSPENDED');
        this.name = 'DownloadSuspendedError';
    }
}

export function isDownloadSuspended(error: unknown): error is DownloadSuspendedError {
    return error instanceof DownloadSuspendedError;
}

class RetryableTransferError extends Error { }
class RestartTransferError extends RetryableTransferError { }
class PermanentTransferError extends Error { }
class RedirectCandidates extends Error {
    readonly urls: readonly string[];

    constructor(urls: readonly string[]) {
        super('Download route selected');
        this.urls = urls;
    }
}
class FatalDiskError extends Error {
    constructor(error: unknown) {
        super(error instanceof Error ? error.message : String(error), { cause: error });
    }
}

function cancellationError(): Error {
    return new Error('CANCELLED_BY_USER');
}

function isCancellation(error: unknown, signal?: AbortSignal): boolean {
    return signal?.aborted === true ||
        (error instanceof Error && error.message === 'CANCELLED_BY_USER');
}

function displayServerName(url: string): string {
    const hostname = new URL(url).hostname;
    return /^(filecache\d+)\.gamebanana\.com$/.exec(hostname)?.[1] ?? hostname;
}

function parseLength(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseContentRange(value: string | undefined): { start: number; end: number; total: number } | undefined {
    const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(value ?? '');
    if (!match) return undefined;
    const [, rawStart, rawEnd, rawTotal] = match;
    const start = Number(rawStart);
    const end = Number(rawEnd);
    const total = Number(rawTotal);
    if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) {
        return undefined;
    }
    return { start, end, total };
}

function parseUnsatisfiedRange(value: string | undefined): number | undefined {
    const match = /^bytes\s+\*\/(\d+)$/i.exec(value ?? '');
    if (!match) return undefined;
    const total = Number(match[1]);
    return Number.isSafeInteger(total) && total >= 0 ? total : undefined;
}

function responseValidator(headers: IncomingHttpHeaders): Validator | undefined {
    const etag = headers.etag;
    if (typeof etag === 'string' && !/^W\//i.test(etag)) {
        return { header: 'ETag', value: etag };
    }
    const modified = headers['last-modified'];
    return typeof modified === 'string'
        ? { header: 'Last-Modified', value: modified }
        : undefined;
}

function sameValidator(expected: Validator, headers: IncomingHttpHeaders): boolean {
    const actual = expected.header === 'ETag' ? headers.etag : headers['last-modified'];
    return actual === expected.value;
}

function parseContentDispositionFilename(header: string): string | undefined {
    const encoded = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
    if (encoded) {
        try {
            const decoded = decodeURIComponent(encoded[2].trim()).replace(/^"|"$/g, '');
            if (decoded) return decoded;
        } catch { /* fall through to the legacy form */ }
    }
    const legacy = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
    return legacy?.[1].trim() || undefined;
}

async function singleResponse(
    url: string,
    headers: Record<string, string>,
    connectionTimeoutMs: number,
    signal?: AbortSignal,
    agent?: Agent,
): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(cancellationError());
            return;
        }

        const parsed = new URL(url);
        const protocol = parsed.protocol === 'https:' ? https : parsed.protocol === 'http:' ? http : undefined;
        if (!protocol) {
            reject(new Error(`Unsupported download protocol: ${parsed.protocol}`));
            return;
        }

        let settled = false;
        const request = protocol.get(parsed, { headers, agent }, (response) => finish(undefined, response));
        const abort = () => {
            const error = cancellationError();
            request.destroy(error);
            finish(error);
        };
        const finish = (error?: Error, response?: IncomingMessage) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abort);
            if (error) {
                // A suspended job must not release the FIFO while its socket is
                // still open, including requests waiting for response headers.
                if (request.closed) reject(error);
                else {
                    request.once('close', () => reject(error));
                    request.destroy();
                }
            } else resolve(response!);
        };
        const timeout = setTimeout(() => {
            const error = new RetryableTransferError(
                `Download connection timed out after ${connectionTimeoutMs / 1000} seconds`,
            );
            request.destroy(error);
            finish(error);
        }, connectionTimeoutMs);
        request.on('error', (error) => {
            finish(signal?.aborted ? cancellationError() : new RetryableTransferError(describeNetworkError(error)));
        });
        signal?.addEventListener('abort', abort, { once: true });
    });
}

async function requestResponse(
    initialUrl: string,
    headers: Record<string, string>,
    connectionTimeoutMs: number,
    signal?: AbortSignal,
    resolveRedirectCandidates?: DownloadTransferOptions['resolveRedirectCandidates'],
    agent?: Agent,
): Promise<IncomingMessage> {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
        const response = await singleResponse(url, headers, connectionTimeoutMs, signal, agent);
        if (![301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) return response;
        const location = response.headers.location;
        response.destroy();
        await finished(response, { cleanup: true }).catch(() => undefined);
        if (!location) throw new RetryableTransferError('Download redirect did not include a location');
        if (redirects === 5) throw new RetryableTransferError('Too many download redirects');
        const redirected = new URL(location, url);
        const previous = new URL(url);
        const localTestRedirect = ['127.0.0.1', 'localhost', '::1'].includes(previous.hostname) &&
            redirected.hostname === previous.hostname &&
            ['http:', 'https:'].includes(redirected.protocol);
        const gameBananaRedirect = redirected.protocol === 'https:' &&
            isAllowedGameBananaDownloadHostname(redirected.hostname);
        if (!localTestRedirect && !gameBananaRedirect) {
            throw new RetryableTransferError(
                `Download redirect was rejected: ${redirected.protocol}//${redirected.hostname}`,
            );
        }
        const candidates = await resolveRedirectCandidates?.(redirected.toString(), signal);
        if (candidates?.length) {
            for (const candidate of candidates) {
                const parsed = new URL(candidate);
                const localCandidate = localTestRedirect && parsed.hostname === previous.hostname &&
                    ['http:', 'https:'].includes(parsed.protocol);
                if (!localCandidate && !(parsed.protocol === 'https:' &&
                    isAllowedGameBananaDownloadHostname(parsed.hostname))) {
                    throw new RetryableTransferError('Download route returned an untrusted server');
                }
            }
            throw new RedirectCandidates(candidates);
        }
        url = redirected.toString();
    }
    throw new RetryableTransferError('Too many download redirects');
}

async function fileSize(path: string): Promise<number> {
    try {
        return (await fs.stat(path)).size;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
        throw new FatalDiskError(error);
    }
}

async function writeAll(file: FileHandle, chunk: Buffer): Promise<void> {
    let offset = 0;
    while (offset < chunk.length) {
        try {
            const { bytesWritten } = await file.write(chunk, offset, chunk.length - offset, null);
            if (bytesWritten <= 0) throw new Error('Unable to write download data');
            offset += bytesWritten;
        } catch (error) {
            throw error instanceof FatalDiskError ? error : new FatalDiskError(error);
        }
    }
}

async function consumeResponse(
    response: IncomingMessage,
    destinationPath: string,
    mode: 'a' | 'w',
    startingOffset: number,
    expectedResponseBytes: number | undefined,
    total: number | undefined,
    stallTimeoutMs: number,
    onProgress: (downloaded: number, total: number) => void,
    signal?: AbortSignal,
    persistProgress?: PersistProgress,
): Promise<void> {
    let file: FileHandle;
    try {
        file = await fs.open(destinationPath, mode);
    } catch (error) {
        response.destroy();
        await finished(response, { cleanup: true }).catch(() => undefined);
        throw new FatalDiskError(error);
    }

    let received = 0;
    let hash: ReturnType<typeof createHash> | undefined;
    try { hash = persistProgress ? await prefixHash(destinationPath, startingOffset) : undefined; }
    catch (error) { response.destroy(); await file.close(); throw new FatalDiskError(error); }
    let checkpointBytes = startingOffset, checkpointTime = Date.now();
    let stallTimer: NodeJS.Timeout | undefined;
    let forcedError: Error | undefined;
    const armStallTimer = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
            forcedError = new RetryableTransferError(
                `Download stalled - no data received for ${stallTimeoutMs / 1000} seconds`,
            );
            response.destroy(forcedError);
        }, stallTimeoutMs);
    };
    const abort = () => {
        forcedError = cancellationError();
        response.destroy(forcedError);
    };

    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    armStallTimer();
    let transferError: Error | undefined;
    let closeError: unknown;
    try {
        for await (const value of response) {
            if (signal?.aborted) throw cancellationError();
            const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
            armStallTimer();
            await writeAll(file, chunk);
            hash?.update(chunk);
            received += chunk.length;
            if (persistProgress && hash && (received + startingOffset - checkpointBytes >= 4 * 1024 * 1024 || Date.now() - checkpointTime >= 1000)) {
                await file.sync();
                await persistProgress(startingOffset + received, hash.copy().digest('hex'));
                checkpointBytes = startingOffset + received; checkpointTime = Date.now();
            }
            onProgress(startingOffset + received, total ?? 0);
        }
        if (signal?.aborted) throw cancellationError();
        if (!response.complete) {
            throw new RetryableTransferError('Download response ended before the full body was received');
        }
        if (expectedResponseBytes !== undefined && received !== expectedResponseBytes) {
            throw new RetryableTransferError(
                `Download response was incomplete: expected ${expectedResponseBytes} bytes, received ${received}`,
            );
        }
    } catch (error) {
        if (forcedError) transferError = forcedError;
        else if (isCancellation(error, signal)) transferError = cancellationError();
        else if (error instanceof FatalDiskError || error instanceof RetryableTransferError) transferError = error;
        else transferError = new RetryableTransferError(error instanceof Error ? error.message : String(error));
    } finally {
        if (stallTimer) clearTimeout(stallTimer);
        signal?.removeEventListener('abort', abort);
        response.destroy();
        await finished(response, { cleanup: true }).catch(() => undefined);
        try {
            if (persistProgress && hash && received > 0) {
                await file.sync();
                await persistProgress(startingOffset + received, hash.copy().digest('hex'));
            }
        } catch (error) { closeError = error; }
        finally { try { await file.close(); } catch (error) { closeError ??= error; } }
    }
    if (closeError) throw new FatalDiskError(closeError);
    if (transferError) throw transferError;
}

async function attemptCandidate(
    url: string,
    destinationPath: string,
    state: DownloadTransferCheckpoint,
    options: Pick<DownloadTransferOptions,
        'onProgress' | 'onResponseFilename' | 'connectionTimeoutMs' | 'stallTimeoutMs' | 'signal' |
        'resolveRedirectCandidates' | 'agent'> & { persistProgress?: PersistProgress },
    onAccepted?: () => void,
): Promise<void> {
    const offset = await fileSize(destinationPath);
    if (offset > 0 && !state.validator) {
        throw new RestartTransferError('Cannot safely resume without a stable server validator');
    }

    const headers: Record<string, string> = { 'Accept-Encoding': 'identity' };
    if (offset > 0) {
        headers.Range = `bytes=${offset}-`;
        headers['If-Range'] = state.validator!.value;
    }
    const response = await requestResponse(
        url, headers, options.connectionTimeoutMs!, options.signal, options.resolveRedirectCandidates, options.agent,
    );
    const disposition = response.headers['content-disposition'];
    if (typeof disposition === 'string') {
        const filename = parseContentDispositionFilename(disposition);
        if (filename) options.onResponseFilename?.(filename);
    }

    if (offset > 0 && response.statusCode === 416) {
        const total = parseUnsatisfiedRange(response.headers['content-range']);
        response.destroy();
        await finished(response, { cleanup: true }).catch(() => undefined);
        if (total === offset && total === state.total && sameValidator(state.validator!, response.headers)) return;
        throw new RestartTransferError('Download server rejected the resume offset');
    }

    let mode: 'a' | 'w';
    let startingOffset: number;
    let expectedResponseBytes: number | undefined;
    let total: number | undefined;
    if (offset > 0 && response.statusCode === 206) {
        const range = parseContentRange(response.headers['content-range']);
        const contentLength = parseLength(response.headers['content-length']);
        if (!range || range.start !== offset ||
            (state.total !== undefined && range.total !== state.total) ||
            !sameValidator(state.validator!, response.headers) ||
            (contentLength !== undefined && contentLength !== range.end - range.start + 1)) {
            response.destroy();
            await finished(response, { cleanup: true }).catch(() => undefined);
            throw new RestartTransferError('Download server returned an incompatible resume response');
        }
        mode = 'a';
        startingOffset = offset;
        expectedResponseBytes = range.end - range.start + 1;
        total = range.total;
    } else if (response.statusCode === 200) {
        // A full response to a Range request means the server ignored Range or
        // rejected If-Range. Truncate before consuming it so bytes never mix.
        mode = 'w';
        startingOffset = 0;
        expectedResponseBytes = parseLength(response.headers['content-length']);
        total = expectedResponseBytes;
        state.validator = responseValidator(response.headers);
        if (offset > 0) options.onProgress(0, total ?? 0);
    } else {
        response.destroy();
        await finished(response, { cleanup: true }).catch(() => undefined);
        const status = response.statusCode ?? 0;
        if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
            throw new PermanentTransferError(`Download failed with status ${status}`);
        }
        throw new RetryableTransferError(`Download failed with status ${response.statusCode}`);
    }

    state.total = total;
    if (mode === 'a') state.validator = state.validator ?? responseValidator(response.headers);
    onAccepted?.();
    await consumeResponse(
        response,
        destinationPath,
        mode,
        startingOffset,
        expectedResponseBytes,
        total,
        options.stallTimeoutMs!,
        options.onProgress,
        options.signal,
        options.persistProgress,
    );

    const completedSize = await fileSize(destinationPath);
    if (total !== undefined && completedSize !== total) {
        throw new RetryableTransferError(
            `Download incomplete: expected ${total} bytes, received ${completedSize}`,
        );
    }
}

async function removePartial(destinationPath: string): Promise<void> {
    await fs.unlink(destinationPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
    });
}

export async function downloadTransfer(options: DownloadTransferOptions): Promise<void> {
    const {
        candidateUrls,
        destinationPath,
        signal,
        pauseSignal,
        checkpoint,
        onServerStatus,
        connectionTimeoutMs = 30_000,
        mirrorConnectionTimeoutMs = DEFAULT_MIRROR_CONNECTION_TIMEOUT_MS,
        stallTimeoutMs = 60_000,
    } = options;
    if (candidateUrls.length === 0) throw new Error('No download servers available');

    const state: TransferState = checkpoint ?? {};
    if (state.destinationPath !== undefined && state.destinationPath !== destinationPath) {
        throw new Error('Download checkpoint belongs to a different destination');
    }
    if (state.destinationPath === undefined) {
        // No in-memory checkpoint: the partial has no trusted identity unless a
        // verified disk checkpoint (opt-in via resumeMetadataPath) vouches for it.
        if (options.resumeMetadataPath) {
            await assertRecoveryPath(destinationPath); await assertRecoveryPath(options.resumeMetadataPath);
            try {
                const saved = JSON.parse(await fs.readFile(options.resumeMetadataPath, 'utf8')) as TransferState;
                const size = await fileSize(destinationPath);
                if (!Number.isSafeInteger(saved.bytes) || saved.bytes! < 0 || saved.bytes! > size || !/^[0-9a-f]{64}$/.test(saved.sha256 ?? '')
                    || !saved.validator || !['ETag', 'Last-Modified'].includes(saved.validator.header) || typeof saved.validator.value !== 'string' || /[\r\n]/.test(saved.validator.value)
                    || (options.resumeIdentity ? saved.identity !== options.resumeIdentity : JSON.stringify(saved.urls) !== JSON.stringify(candidateUrls)) || (saved.total !== undefined && (!Number.isSafeInteger(saved.total) || saved.total < saved.bytes!))
                    || (await prefixHash(destinationPath, saved.bytes!)).digest('hex') !== saved.sha256) throw new Error('Invalid download checkpoint');
                await fs.truncate(destinationPath, saved.bytes!);
                Object.assign(state, {
                    total: saved.total, validator: saved.validator, bytes: saved.bytes, sha256: saved.sha256,
                    urls: saved.urls, identity: saved.identity,
                });
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code && !['ENOENT'].includes((error as NodeJS.ErrnoException).code!)) throw error;
                await removePartial(destinationPath);
            }
        } else await removePartial(destinationPath);
        state.destinationPath = destinationPath;
    }
    const persistProgress: PersistProgress | undefined = options.resumeMetadataPath
        ? async (bytes, sha256) => {
            state.bytes = bytes; state.sha256 = sha256; state.urls = [...candidateUrls];
            state.identity = options.resumeIdentity;
            // Only the durable fields are written; route/destination bookkeeping is per-run.
            await writeRecoveryJson(options.resumeMetadataPath!, {
                total: state.total, validator: state.validator, bytes, sha256,
                urls: state.urls, identity: state.identity,
            });
        }
        : undefined;
    const durable = options.resumeMetadataPath !== undefined;
    const interruptedSignal = signal && pauseSignal
        ? AbortSignal.any([signal, pauseSignal])
        : signal ?? pauseSignal;
    const resetState = () => {
        state.total = undefined;
        state.validator = undefined;
        state.bytes = undefined;
        state.sha256 = undefined;
    };
    const checkInterruption = async () => {
        if (signal?.aborted) {
            // A durable partial outlives a cancelled attempt; the caller decides its fate.
            if (!durable) {
                await removePartial(destinationPath).catch(() => undefined);
                resetState();
            }
            throw cancellationError();
        }
        if (pauseSignal?.aborted) throw new DownloadSuspendedError();
    };
    let lastError: Error | undefined;
    let previousServer: string | undefined;

    const urls = [...new Set(state.candidateUrls ?? candidateUrls)];
    const retries = Math.min(3, Math.max(0, options.retryCount ?? 0));
    let routeChanges = 0;
    rounds: for (let round = 0; round <= retries; round += 1) {
        if (round > 0) {
            options.onRetry?.(round);
            await new Promise<void>((resolve) => {
                const done = () => { clearTimeout(timer); interruptedSignal?.removeEventListener('abort', done); resolve(); };
                const timer = setTimeout(done, Math.min(4000, 500 * 2 ** (round - 1)));
                if (interruptedSignal?.aborted) done(); else interruptedSignal?.addEventListener('abort', done, { once: true });
            });
            await checkInterruption();
        }
        let transient = false;
        const firstIndex = round === 0 && state.candidateUrl ? Math.max(0, urls.indexOf(state.candidateUrl)) : 0;
        for (let index = firstIndex; index < urls.length; index += 1) {
            await checkInterruption();
            const url = urls[index];
            state.candidateUrl = url;
            const server = displayServerName(url);
            // Only the last candidate is a route GameBanana itself vouched for. The
            // rest are speculative mirrors, so a dead one must not eat the full budget.
            const candidateConnectionTimeoutMs = index === urls.length - 1
                ? connectionTimeoutMs
                : Math.min(connectionTimeoutMs, mirrorConnectionTimeoutMs);
            if (previousServer === undefined) onServerStatus?.({ phase: 'selected', server });
            else onServerStatus?.({ phase: 'switching', server, previousServer });

            try {
                // One bounded retry lets a candidate that cannot safely resume use
                // a clean full request instead of being skipped outright.
                for (let safeRestarts = 0; ; safeRestarts += 1) {
                    try {
                        await attemptCandidate(url, destinationPath, state, {
                            ...options,
                            signal: interruptedSignal,
                            connectionTimeoutMs: candidateConnectionTimeoutMs,
                            stallTimeoutMs,
                            persistProgress,
                        }, previousServer === undefined ? undefined : () => {
                            onServerStatus?.({ phase: 'selected', server });
                        });
                        return;
                    } catch (error) {
                        if (!(error instanceof RestartTransferError) || safeRestarts > 0) throw error;
                        await removePartial(destinationPath).catch((cleanupError) => {
                            throw new FatalDiskError(cleanupError);
                        });
                        resetState();
                        options.onProgress(0, 0);
                    }
                }
            } catch (error) {
                await checkInterruption();
                if (error instanceof RedirectCandidates) {
                    if (++routeChanges > 10) {
                        lastError = new Error('Too many download route changes');
                        break rounds;
                    }
                    const routes = [...new Set([...error.urls, ...urls.slice(index + 1)])];
                    urls.splice(index, urls.length - index, ...routes);
                    state.candidateUrls = [...urls];
                    index -= 1;
                    continue;
                }
                if (isCancellation(error, signal)) {
                    if (!durable) {
                        await removePartial(destinationPath).catch(() => undefined);
                        resetState();
                    }
                    throw cancellationError();
                }
                if (error instanceof FatalDiskError) {
                    await removePartial(destinationPath).catch(() => undefined);
                    throw error.cause instanceof Error ? error.cause : error;
                }
                if (error instanceof RestartTransferError) {
                    await removePartial(destinationPath).catch((cleanupError) => {
                        throw new FatalDiskError(cleanupError);
                    });
                    resetState();
                    options.onProgress(0, 0);
                }
                lastError = error instanceof Error ? error : new Error(String(error));
                // A definitive 4xx answer is worth trying on the next server but never worth another round.
                if (!(error instanceof PermanentTransferError)) transient = true;
                console.warn(`[download] ${server} failed: ${lastError.message}`);
                previousServer = server;
            }
        }
        if (!transient) break;
    }
    if (!durable) {
        await removePartial(destinationPath).catch(() => undefined);
        resetState();
    }
    throw lastError ?? new Error('Download failed');
}
