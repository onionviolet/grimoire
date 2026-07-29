#!/usr/bin/env node
/**
 * Drive a running dev build of Grimoire from the command line.
 *
 * Screenshot-and-click is a poor way to check that a list rendered the right
 * rows: it cannot read text reliably, it breaks on window size, and it says
 * nothing about why something is missing. This talks to the renderer over the
 * Chrome DevTools Protocol instead, so a check can be a question about the DOM
 * ("what do the change rows say?") rather than a guess about pixels.
 *
 * Start the app with the port open, then drive it:
 *
 *   GRIMOIRE_DEV_CDP_PORT=9222 pnpm dev
 *   node scripts/dev-driver.mjs eval "location.hash"
 *   node scripts/dev-driver.mjs text "nav"
 *   node scripts/dev-driver.mjs click "button:has-text(My changes)"
 *   node scripts/dev-driver.mjs shot out.png
 *
 * This is a development tool. It evaluates arbitrary code in the renderer, and
 * the port it needs is opt-in for that reason (see electron/main/index.ts).
 */
import { readFileSync, writeFileSync } from 'fs';

const PORT = process.env.GRIMOIRE_DEV_CDP_PORT || '9222';
const HOST = `http://127.0.0.1:${PORT}`;

/** The renderer target, skipping devtools and any extension pages. */
async function pageTarget() {
    const res = await fetch(`${HOST}/json/list`);
    if (!res.ok) throw new Error(`CDP list failed: ${res.status}`);
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
    if (!page) throw new Error(`No renderer page found. Targets: ${targets.map((t) => `${t.type} ${t.url}`).join(', ') || 'none'}`);
    return page;
}

/**
 * One request/response over the target's WebSocket. A fresh socket per command
 * keeps the CLI stateless; the cost is a connect per call, which is irrelevant
 * next to the render it is inspecting.
 */
function send(wsUrl, method, params = {}) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl, { headers: { Origin: 'http://127.0.0.1' } });
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error(`CDP ${method} timed out after 20s`));
        }, 20_000);
        ws.addEventListener('open', () => ws.send(JSON.stringify({ id: 1, method, params })));
        ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id !== 1) return;
            clearTimeout(timer);
            ws.close();
            if (message.error) reject(new Error(`${method}: ${message.error.message}`));
            else resolve(message.result);
        });
        ws.addEventListener('error', () => {
            clearTimeout(timer);
            reject(new Error(`Could not reach the renderer on ${HOST}. Is the app running with GRIMOIRE_DEV_CDP_PORT=${PORT}?`));
        });
    });
}

async function evaluate(expression) {
    const page = await pageTarget();
    const result = await send(page.webSocketDebuggerUrl, 'Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        // User-gesture semantics: without this, click handlers gated on
        // transient activation (file pickers, media) silently do nothing.
        userGesture: true,
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
}

/** `:has-text(...)` is not a real selector, so resolve it ourselves: match the
 *  deepest element whose trimmed text contains the phrase. */
function findExpression(selector) {
    const match = /^(.*?):has-text\((.*)\)$/s.exec(selector);
    if (!match) return `document.querySelector(${JSON.stringify(selector)})`;
    const [, base, phrase] = match;
    return `[...document.querySelectorAll(${JSON.stringify(base || '*')})]
        .filter((el) => (el.textContent || '').trim().toLowerCase().includes(${JSON.stringify(phrase.trim().toLowerCase())}))
        .at(-1)`;
}

const [command, ...rest] = process.argv.slice(2);
const argument = rest.join(' ');

try {
    switch (command) {
        case 'eval': {
            const value = await evaluate(argument);
            console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
            break;
        }
        case 'evalfile': {
            // Anything past a one-liner loses a fight with shell quoting
            // (backslashes in Windows paths, nested quotes, template literals),
            // so read the expression from a file instead of the argv.
            const value = await evaluate(readFileSync(argument, 'utf8'));
            console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
            break;
        }
        case 'text': {
            const value = await evaluate(`(${findExpression(argument || 'body')})?.innerText ?? null`);
            console.log(value ?? '(no match)');
            break;
        }
        case 'html': {
            const value = await evaluate(`(${findExpression(argument || 'body')})?.outerHTML ?? null`);
            console.log(value ?? '(no match)');
            break;
        }
        case 'click': {
            const value = await evaluate(`(() => {
                const el = ${findExpression(argument)};
                if (!el) return 'no match';
                el.scrollIntoView({ block: 'center' });
                el.click();
                return 'clicked: ' + (el.innerText || el.tagName).slice(0, 80);
            })()`);
            console.log(value);
            break;
        }
        case 'fill': {
            // React ignores a plain `.value =`, so go through the native setter
            // and dispatch the event its onChange is actually listening for.
            const [selector, ...valueParts] = rest;
            const value = valueParts.join(' ');
            console.log(await evaluate(`(() => {
                const el = ${findExpression(selector)};
                if (!el) return 'no match';
                const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
                Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return 'filled';
            })()`));
            break;
        }
        case 'select': {
            const [selector, ...valueParts] = rest;
            const value = valueParts.join(' ');
            console.log(await evaluate(`(() => {
                const el = ${findExpression(selector)};
                if (!el) return 'no match';
                Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return 'selected ' + el.value;
            })()`));
            break;
        }
        case 'route': {
            // Git Bash rewrites a leading-slash argument into a Windows path
            // (`/foundry` -> `C:/Program Files/Git/foundry`), which pushState
            // then rejects as a cross-origin URL. Take the last path segment as
            // the route so both `foundry` and a mangled `/foundry` work.
            const raw = argument.trim();
            const mangled = /^[A-Za-z]:[\\/]/.test(raw);
            const route = `/${(mangled ? raw.split(/[\\/]/).pop() : raw).replace(/^\/+/, '')}`;
            // The app mounts a HashRouter (App.tsx), so the route lives in
            // location.hash. Driving pathname instead changes the URL bar and
            // nothing else, which reads as a passing navigation while the view
            // never moves; setting the hash fires hashchange and the router
            // follows it. Works under file:// too, unlike a real navigation.
            console.log(await evaluate(`(() => {
                location.hash = ${JSON.stringify('#' + route)};
                return 'hash is now ' + location.hash;
            })()`));
            break;
        }
        case 'viewport': {
            // Layout bugs are width bugs, and the real window cannot always be
            // resized to the size you need to reproduce one (high-DPI displays
            // give a much smaller CSS viewport than the pixel size suggests).
            // `viewport 0 0` clears the override.
            const [w, h] = rest.map(Number);
            const page = await pageTarget();
            if (!w || !h) {
                await send(page.webSocketDebuggerUrl, 'Emulation.clearDeviceMetricsOverride', {});
                console.log('viewport override cleared');
            } else {
                await send(page.webSocketDebuggerUrl, 'Emulation.setDeviceMetricsOverride', {
                    width: w, height: h, deviceScaleFactor: 1, mobile: false,
                });
                console.log(`viewport forced to ${w}x${h}`);
            }
            break;
        }
        case 'shot': {
            const page = await pageTarget();
            const { data } = await send(page.webSocketDebuggerUrl, 'Page.captureScreenshot', { format: 'png' });
            writeFileSync(argument || 'grimoire.png', Buffer.from(data, 'base64'));
            console.log(`wrote ${argument || 'grimoire.png'}`);
            break;
        }
        case 'targets': {
            const res = await fetch(`${HOST}/json/list`);
            console.log((await res.json()).map((t) => `${t.type}\t${t.url}`).join('\n'));
            break;
        }
        default:
            console.log('usage: dev-driver.mjs <eval|evalfile|text|html|click|fill|select|route|viewport|shot|targets> [argument]');
            process.exitCode = 1;
    }
} catch (error) {
    console.error(String(error.message || error));
    process.exitCode = 1;
}
