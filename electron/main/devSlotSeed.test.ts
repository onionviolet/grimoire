import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedDevSlotUserData } from './devSlotSeed';

describe('dev slot seeding', () => {
    let root: string;
    let source: string;
    let target: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'grimoire-slot-seed-'));
        source = join(root, 'grimoire');
        target = join(root, 'grimoire-dev2');
        mkdirSync(source, { recursive: true });
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    const seedSource = () => {
        writeFileSync(join(source, 'settings.json'), '{"gamePath":"C:/deadlock"}');
        writeFileSync(join(source, 'mod-metadata.json'), '{"mods":[]}');
        writeFileSync(join(source, 'mods-cache.db'), 'db');
        writeFileSync(join(source, 'mods-cache.db-wal'), 'wal');
        writeFileSync(join(source, 'mods-cache.db-shm'), 'shm');
        writeFileSync(join(source, 'lockfile'), '');
        mkdirSync(join(source, 'hero-poses'), { recursive: true });
        writeFileSync(join(source, 'hero-poses', 'abrams.glb'), 'glb');
        mkdirSync(join(source, 'Code Cache', 'js'), { recursive: true });
        writeFileSync(join(source, 'Code Cache', 'js', 'blob'), 'x');
    };

    it('copies real state into a new slot', () => {
        seedSource();
        expect(seedDevSlotUserData(source, target)).toBe('seeded');

        // The state that makes a slot usable: settings gate the nav, metadata
        // supplies mod names, and the caches avoid a re-download.
        expect(existsSync(join(target, 'settings.json'))).toBe(true);
        expect(existsSync(join(target, 'mod-metadata.json'))).toBe(true);
        expect(existsSync(join(target, 'mods-cache.db'))).toBe(true);
        expect(existsSync(join(target, 'hero-poses', 'abrams.glb'))).toBe(true);
    });

    it('leaves Chromium profile state behind', () => {
        seedSource();
        seedDevSlotUserData(source, target);

        expect(existsSync(join(target, 'Code Cache'))).toBe(false);
        expect(existsSync(join(target, 'lockfile'))).toBe(false);
    });

    it('copies a database with its WAL but never its -shm', () => {
        seedSource();
        seedDevSlotUserData(source, target);

        expect(existsSync(join(target, 'mods-cache.db-wal'))).toBe(true);
        expect(existsSync(join(target, 'mods-cache.db-shm'))).toBe(false);
    });

    it('never touches an existing slot, so its state survives a restart', () => {
        seedSource();
        mkdirSync(target, { recursive: true });
        writeFileSync(join(target, 'settings.json'), '{"mine":true}');

        expect(seedDevSlotUserData(source, target)).toBe('slot-exists');
        expect(readdirSync(target)).toEqual(['settings.json']);
    });

    it('starts blank when seeding is switched off', () => {
        seedSource();
        expect(seedDevSlotUserData(source, target, false)).toBe('disabled');
        expect(existsSync(target)).toBe(false);
    });

    it('is a no-op on a machine with no real profile yet', () => {
        rmSync(source, { recursive: true, force: true });
        expect(seedDevSlotUserData(source, target)).toBe('no-source');
        expect(existsSync(target)).toBe(false);
    });
});
