import { readFile, writeFile } from 'node:fs/promises';

const version = process.env.GITHUB_REF_NAME?.replace(/^v/, '') ?? process.argv[2];
if (!version) throw new Error('Pass a release version or run from a v<version> tag.');

const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const heading = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\].*$`, 'm');
const match = heading.exec(changelog);
if (!match) throw new Error(`CHANGELOG.md has no section for ${version}.`);

const start = match.index;
const next = changelog.indexOf('\n## ', start + match[0].length);
const notes = changelog.slice(start, next === -1 ? undefined : next).trim();
await writeFile(new URL('../release-notes.md', import.meta.url), `${notes}\n`, 'utf8');
