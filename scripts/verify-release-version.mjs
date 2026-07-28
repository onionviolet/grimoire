import { readFile } from 'node:fs/promises';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:(?:0|[1-9]\d*)|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = packageJson.version;

if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new Error(`package.json version must be strict SemVer; received ${JSON.stringify(version)}.`);
}

const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
if (tag !== undefined) {
    if (!tag.startsWith('v') || !SEMVER.test(tag.slice(1))) {
        throw new Error(`Release tag must be v<strict-semver>; received ${JSON.stringify(tag)}.`);
    }
    if (tag.slice(1) !== version) {
        throw new Error(`Release tag ${tag} must match package.json version ${version}.`);
    }
}

console.log(`Release version verified: ${version}${tag ? ` (tag ${tag})` : ''}`);
