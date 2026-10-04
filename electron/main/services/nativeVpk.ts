const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    return crc >>> 0;
});
export function vpkCrc32(bytes: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}


export function writeNativeVpk(entries: Map<string, Buffer>): Buffer {
    const groups = new Map<string, Map<string, { name: string; bytes: Buffer }[]>>();
    for (const [path, bytes] of entries) {
        const slash = path.lastIndexOf('/');
        const dot = path.lastIndexOf('.');
        const extension = dot > slash ? path.slice(dot + 1) : ' ';
        const directory = slash >= 0 ? path.slice(0, slash) : ' ';
        const name = path.slice(slash + 1, dot > slash ? dot : undefined);
        if (!groups.has(extension)) groups.set(extension, new Map());
        const directories = groups.get(extension)!;
        if (!directories.has(directory)) directories.set(directory, []);
        directories.get(directory)!.push({ name, bytes });
    }
    const tree: Buffer[] = [];
    const payload: Buffer[] = [];
    let offset = 0;
    const nul = (value: string) => Buffer.from(`${value}\0`, 'utf8');
    for (const [extension, directories] of groups) {
        tree.push(nul(extension));
        for (const [directory, files] of directories) {
            tree.push(nul(directory));
            for (const { name, bytes } of files) {
                const entry = Buffer.alloc(18);
                entry.writeUInt32LE(vpkCrc32(bytes));
                entry.writeUInt16LE(0x7fff, 6);
                entry.writeUInt32LE(offset, 8);
                entry.writeUInt32LE(bytes.length, 12);
                entry.writeUInt16LE(0xffff, 16);
                tree.push(nul(name), entry);
                payload.push(bytes);
                offset += bytes.length;
            }
            tree.push(nul(''));
        }
        tree.push(nul(''));
    }
    tree.push(nul(''));
    const directory = Buffer.concat(tree);
    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x55aa1234);
    header.writeUInt32LE(1, 4);
    header.writeUInt32LE(directory.length, 8);
    return Buffer.concat([header, directory, ...payload]);
}
