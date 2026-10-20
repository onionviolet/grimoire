import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
const slot = Number(process.env.GRIMOIRE_DEV_SLOT);
if (!Number.isSafeInteger(slot) || slot < 1) throw Error('Use an isolated GRIMOIRE_DEV_SLOT greater than zero.');
const fixtureRoot = mkdtempSync(join(tmpdir(), 'grimoire-browser-filter-check-'));
const server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url?.endsWith('.js') ? 'application/javascript' : 'text/html');
    if (request.url === '/adprobe.js') response.end('window.adProbeLoaded=true;');
    else if (request.url === '/safe.js') response.end('window.safeProbeLoaded=true;');
    else response.end('<!doctype html><title>Filter fixture</title><h1>Browser filter check</h1><div class="test-ad">Fixture ad</div><script src="/adprobe.js"></script><script src="/safe.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const fixtureUrl = `http://127.0.0.1:${port}/index.html`;
const fixtureOrigin = `http://127.0.0.1:${port}`;
const customPath = join(fixtureRoot, 'custom.txt');
writeFileSync(customPath, `|${fixtureOrigin}/adprobe.js|$script\n127.0.0.1##.test-ad\nexample.test#?#unsupported\n`);
let originalSettings;

const endpoint=`http://127.0.0.1:${9222 + slot}/json/list`;
async function targets(){return fetch(endpoint).then(r=>r.json());}
async function evalTarget(target,expression){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  const timer=setTimeout(()=>{ws.close();reject(Error('CDP timeout'));},12000);
  ws.onopen=()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true,userGesture:true}}));
  ws.onerror=error=>{clearTimeout(timer);reject(error);};
  ws.onmessage=e=>{const r=JSON.parse(e.data);if(r.id!==1)return;clearTimeout(timer);ws.close();if(r.error||r.result.exceptionDetails)reject(Error(JSON.stringify(r.error||r.result.exceptionDetails)));else resolve(r.result.result.value);};
 });
}
async function root(expression){const page=(await targets()).find(t=>t.type==='page'&&!t.url.startsWith('devtools://'));return evalTarget(page,expression);}
async function guest(expression){const page=(await targets()).find(t=>t.type==='webview'&&t.url.startsWith(fixtureOrigin+'/'));if(!page)throw Error('Fixture guest missing');return evalTarget(page,expression);}
async function until(fn){const end=Date.now()+18000;while(Date.now()<end){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('UI wait timed out');}
async function click(text){await root(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='${text}');if(!b||b.disabled)throw Error('Missing button');b.click();return true;})()`);}
async function read(){await until(()=>guest('window.safeProbeLoaded===true'));return guest(`({ad:window.adProbeLoaded===true,hidden:getComputedStyle(document.querySelector('.test-ad')).display==='none',safe:window.safeProbeLoaded===true})`);}
function assert(value,message){if(!value)throw Error(message);}
try {
await until(()=>root(`window.__GRIMOIRE_DEV_SLOT===${slot}`));
originalSettings = await root('window.electronAPI.getSettings()');
if (originalSettings.deadlockPath || originalSettings.devDeadlockPath) throw Error('Use a blank test profile without a game path.');
await root(`window.electronAPI.setSettings({...${JSON.stringify(originalSettings)},experimentalBrowser:true,hasCompletedSetup:true,browserBlockTrackers:true,browserFilterExceptions:[],browserBlockListPath:${JSON.stringify(customPath)}})`);
await root('window.electronAPI.browser.reloadFilter()');
// Refresh the renderer store from the isolated settings, then open Browser.
await root('location.reload();true');
await until(()=>root(`window.__GRIMOIRE_DEV_SLOT===${slot}`));
assert(await root('window.__GRIMOIRE_DEV_SLOT')===slot,'Wrong slot');
await root('location.hash="/browser";true');
await until(()=>root('!!document.querySelector("webview")'));
await root(`(async()=>{const e=document.querySelector('input[aria-label="Enter a web address"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'${fixtureUrl}');e.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));document.querySelector('form').requestSubmit();return true;})()`);
await until(()=>root(`document.querySelector('webview')?.getURL()==='${fixtureUrl}'`));
let result=await read();assert(!result.ad&&result.hidden&&result.safe,'Packaged blocking/cosmetics failed');console.log('enabled',JSON.stringify(result));
const permission=await guest(`navigator.permissions.query({name:'geolocation'}).then(r=>r.state)`);assert(permission==='denied','Permission floor failed');
await root(`(()=>{[...document.querySelectorAll('summary')].find(s=>s.textContent.startsWith('Ad blocker')).click();return true;})()`);
await click('Pause for this site');await until(()=>root(`window.electronAPI.browser.filterStats().then(s=>s.exceptions.includes('${fixtureOrigin}'))`));
await until(async()=>{const r=await read();return r.ad&&!r.hidden;});console.log('paused',JSON.stringify(await read()));
await click('Resume for this site');await until(async()=>{const r=await read();return !r.ad&&r.hidden;});console.log('resumed',JSON.stringify(await read()));
await root(`(async()=>{const s=await window.electronAPI.getSettings();await window.electronAPI.setSettings({...s,browserBlockTrackers:false});await window.electronAPI.browser.reloadFilter();document.querySelector('webview').reload();return true;})()`);
await until(async()=>{const r=await read();return r.ad&&!r.hidden;});console.log('off',JSON.stringify(await read()));
await root(`(async()=>{const s=await window.electronAPI.getSettings();await window.electronAPI.setSettings({...s,browserBlockTrackers:true});await window.electronAPI.browser.reloadFilter();document.querySelector('webview').reload();return true;})()`);
await until(async()=>{const r=await read();return !r.ad&&r.hidden;});
const stats=await root('window.electronAPI.browser.filterStats()');
console.log('final',JSON.stringify({...stats,geolocation:permission}));

} finally {
    if (originalSettings) {
        await root(`window.electronAPI.setSettings(${JSON.stringify(originalSettings)})`).catch(() => {});
        await root('window.electronAPI.browser.reloadFilter()').catch(() => {});
    }
    server.close(); rmSync(fixtureRoot, { recursive: true, force: true });
}
