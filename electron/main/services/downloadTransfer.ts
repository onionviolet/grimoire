import { promises as fs, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { writeRecoveryJson, assertRecoveryPath } from './recoveryBackup';
import type { FileHandle } from 'fs/promises';
import http, { type IncomingHttpHeaders, type IncomingMessage } from 'http';
import https from 'https';
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
    stallTimeoutMs?: number;
    signal?: AbortSignal;
    onServerStatus?: (status: DownloadServerStatus) => void;
    /** Opt-in disk checkpoints; callers without this keep the existing cleanup contract. */
    resumeMetadataPath?: string;
    resumeIdentity?: string;
    retryCount?: number;
    onRetry?: (attempt: number) => void;
    checkpoint?: (bytes: number, sha256: string) => Promise<void>;
}

type Validator = { header: 'ETag' | 'Last-Modified'; value: string };
type TransferState = { total?: number; validator?: Validator; bytes?: number; sha256?: string; urls?: string[]; identity?: string };

async function prefixHash(path: string, bytes: number) {
    const hash = createHash('sha256');
    if (bytes > 0) for await (const chunk of createReadStream(path, { start: 0, end: bytes - 1 })) hash.update(chunk);
    return hash;
}

class RetryableTransferError extends Error { }
class RestartTransferError extends RetryableTransferError { }
class PermanentTransferError extends Error { }
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
        const request = protocol.get(parsed, { headers }, (response) => finish(undefined, response));
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
            if (error) reject(error);
            else resolve(response!);
        };
        const timeout = setTimeout(() => {
            const error = new RetryableTransferError(
                `Download connection timed out after ${connectionTimeoutMs / 1000} seconds`,
            );
            request.destroy(error);
            finish(error);
        }, connectionTimeoutMs);
        request.on('error', (error) => {
            finish(signal?.aborted ? cancellationError() : new RetryableTransferError(error.message));
        });
        signal?.addEventListener('abort', abort, { once: true });
    });
}

async function requestResponse(
    initialUrl: string,
    headers: Record<string, string>,
    connectionTimeoutMs: number,
    signal?: AbortSignal,
): Promise<IncomingMessage> {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
        const response = await singleResponse(url, headers, connectionTimeoutMs, signal);
        if (![301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) return response;
        const location = response.headers.location;
        response.resume();
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
    checkpoint?: (bytes: number, sha256: string) => Promise<void>,
): Promise<void> {
    let file: FileHandle;
    try {
        file = await fs.open(destinationPath, mode);
    } catch (error) {
        response.destroy();
        throw new FatalDiskError(error);
    }

    let received = 0;
    let hash: ReturnType<typeof createHash> | undefined;
    try { hash = checkpoint ? await prefixHash(destinationPath, startingOffset) : undefined; }
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
            if (checkpoint && hash && (received + startingOffset - checkpointBytes >= 4 * 1024 * 1024 || Date.now() - checkpointTime >= 1000)) {
                await file.sync();
                await checkpoint(startingOffset + received, hash.copy().digest('hex'));
                checkpointBytes = startingOffset + received; checkpointTime = Date.now();
            }
            onProgress(startingOffset + received, total ?? 0);
        }
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
        try {
            if (checkpoint && hash && received > 0) {
                await file.sync();
                await checkpoint(startingOffset + received, hash.copy().digest('hex'));
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
    state: TransferState,
    options: Pick<DownloadTransferOptions,
        'onProgress' | 'onResponseFilename' | 'connectionTimeoutMs' | 'stallTimeoutMs' | 'signal' | 'checkpoint'>,
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
    const response = await requestResponse(url, headers, options.connectionTimeoutMs!, options.signal);
    const disposition = response.headers['content-disposition'];
    if (typeof disposition === 'string') {
        const filename = parseContentDispositionFilename(disposition);
        if (filename) options.onResponseFilename?.(filename);
    }

    if (offset > 0 && response.statusCode === 416) {
        const total = parseUnsatisfiedRange(response.headers['content-range']);
        response.resume();
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
            response.resume();
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
    } else {
        response.resume();
        if ((response.statusCode ?? 0) >= 400 && (response.statusCode ?? 0) < 500 && ![408, 429].includes(response.statusCode ?? 0)) throw new PermanentTransferError(`Download failed with status ${response.statusCode}`);
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
        options.checkpoint,
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
        onServerStatus,
        connectionTimeoutMs = 30_000,
        stallTimeoutMs = 60_000,
    } = options;
    if (candidateUrls.length === 0) throw new Error('No download servers available');

    // A previous invocation's file has no in-memory validator, so it cannot be
    // resumed safely. Partials are intentionally durable only within this call.
    let state: TransferState = {};
    if (options.resumeMetadataPath) {
        await assertRecoveryPath(destinationPath); await assertRecoveryPath(options.resumeMetadataPath);
        try {
            const saved = JSON.parse(await fs.readFile(options.resumeMetadataPath, 'utf8')) as TransferState;
            const size = await fileSize(destinationPath);
            if (!Number.isSafeInteger(saved.bytes) || saved.bytes! < 0 || saved.bytes! > size || !/^[0-9a-f]{64}$/.test(saved.sha256 ?? '')
                || !saved.validator || !['ETag', 'Last-Modified'].includes(saved.validator.header) || typeof saved.validator.value !== 'string' || /[\r\n]/.test(saved.validator.value)
                || (options.resumeIdentity ? saved.identity !== options.resumeIdentity : JSON.stringify(saved.urls) !== JSON.stringify(candidateUrls)) || (saved.total !== undefined && (!Number.isSafeInteger(saved.total) || saved.total < saved.bytes!))
                || (await prefixHash(destinationPath, saved.bytes!)).digest('hex') !== saved.sha256) throw new Error('Invalid download checkpoint');
            await fs.truncate(destinationPath, saved.bytes!); state = saved;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code && !['ENOENT'].includes((error as NodeJS.ErrnoException).code!)) throw error;
            await removePartial(destinationPath);
        }
    } else await removePartial(destinationPath);
    const checkpoint = options.resumeMetadataPath ? async (bytes: number, sha256: string) => {
        state.bytes = bytes; state.sha256 = sha256; state.urls = [...candidateUrls];
        state.identity = options.resumeIdentity;
        await writeRecoveryJson(options.resumeMetadataPath!, state);
    } : undefined;
    let lastError: Error | undefined;
    let previousServer: string | undefined;

    const urls = [...new Set(candidateUrls)];
    const retries = Math.min(3, Math.max(0, options.retryCount ?? 0));
    for (const [index, url] of Array.from({ length: retries + 1 }, () => urls).flat().entries()) {
        if (index > 0 && index % urls.length === 0) {
            const attempt = index / urls.length;
            options.onRetry?.(attempt);
            await new Promise<void>((resolve, reject) => {
                const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(cancellationError()); };
                const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, Math.min(4000, 500 * 2 ** (attempt - 1)));
                if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
            });
        }
        if (signal?.aborted) {
            if (!options.resumeMetadataPath) await removePartial(destinationPath).catch(() => undefined);
            throw cancellationError();
        }
        const server = displayServerName(url);
        if (index === 0) onServerStatus?.({ phase: 'selected', server });
        else onServerStatus?.({ phase: 'switching', server, previousServer: previousServer! });

        try {
            // One bounded retry lets a candidate that cannot safely resume use
            // a clean full request instead of being skipped outright.
            for (let safeRestarts = 0; ; safeRestarts += 1) {
                try {
                    await attemptCandidate(url, destinationPath, state, {
                        ...options,
                        connectionTimeoutMs,
                        stallTimeoutMs, checkpoint,
                    }, index === 0 ? undefined : () => {
                        onServerStatus?.({ phase: 'selected', server });
                    });
                    return;
                } catch (error) {
                    if (!(error instanceof RestartTransferError) || safeRestarts > 0) throw error;
                    await removePartial(destinationPath).catch((cleanupError) => {
                        throw new FatalDiskError(cleanupError);
                    });
                    state.total = undefined;
                    state.validator = undefined;
                }
            }
        } catch (error) {
            if (error instanceof PermanentTransferError) throw error;
            if (isCancellation(error, signal)) {
                if (!options.resumeMetadataPath) await removePartial(destinationPath).catch(() => undefined);
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
                state.total = undefined;
                state.validator = undefined;
            }
            lastError = error instanceof Error ? error : new Error(String(error));
            previousServer = server;
        }
    }

    if (!options.resumeMetadataPath) await removePartial(destinationPath).catch(() => undefined);
    throw lastError ?? new Error('Download failed');
}
