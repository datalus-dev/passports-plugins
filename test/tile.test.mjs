import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import CarTileReader from '@dasl/tile-car-reader';
import { masl } from '@dasl/tile-lexicon';
import { buildTile } from '../scripts/build-tile.mjs';
import { DEFAULT_TILE_SIZE, SIZING_FITS, TILE_LIMITS, checkTileManifest, formatTileDate, payloadToProps, tileManifest } from '../scripts/lib/tile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'test', 'fixtures', 'national_parks');
const fields = [
	{ column: 'park_name', type: 'text', card: 'title' },
	{ column: 'park_code', type: 'text', card: 'code' },
	{ column: 'visit_date', type: 'date', card: 'date' },
	{ column: 'rating', type: 'number', card: 'stars' },
	{ column: 'private_note', type: 'text' }
];

describe('formatTileDate', () => {
	it('shows an ISO date as the app does, without a time zone shift', () => {
		expect(formatTileDate('2024-09-14')).toBe('Sep 14, 2024');
		expect(formatTileDate('2025-01-01')).toBe('Jan 1, 2025');
		expect(formatTileDate('2025-12-31')).toBe('Dec 31, 2025');
	});
	it('leaves anything else as it is', () => {
		expect(formatTileDate('Spring 2022')).toBe('Spring 2022');
		expect(formatTileDate('2024-9-4')).toBe('2024-9-4');
		expect(formatTileDate('2024-02-31')).toBe('2024-02-31'); // not a real day
		expect(formatTileDate('2024-13-01')).toBe('2024-13-01');
		expect(formatTileDate(42)).toBe(42);
		expect(formatTileDate(null)).toBeNull();
	});
});

describe('payloadToProps', () => {
	it('maps an entry keyed by column to the card\'s props, formatting a date column', () => {
		expect(payloadToProps(fields, { park_name: 'Acadia', park_code: 'ACAD', visit_date: '2024-09-14', rating: 5 })).toEqual({
			title: 'Acadia', code: 'ACAD', date: 'Sep 14, 2024', stars: 5
		});
	});
	it('passes the card\'s own props straight through', () => {
		expect(payloadToProps(fields, { title: 'Zion', code: 'ZION', date: 'Spring 2022' })).toEqual({ title: 'Zion', code: 'ZION', date: 'Spring 2022' });
	});
	it('lets a column win over a prop of the same name', () => {
		expect(payloadToProps(fields, { title: 'from prop', park_name: 'from column' }).title).toBe('from column');
	});
	it('ignores columns with no card prop and keys that are neither', () => {
		expect(payloadToProps(fields, { private_note: 'secret', note: 'n', other: 'x', variant: 'simplified', controls: 'x' })).toEqual({});
	});
	it('drops values that are not plain text, numbers or booleans', () => {
		expect(payloadToProps(fields, { title: { a: 1 }, code: [1, 2], date: () => 1, stars: NaN })).toEqual({});
		expect(payloadToProps(fields, { park_name: { a: 1 }, rating: Infinity })).toEqual({});
	});
	it('drops empty values, so the card falls back to its own default', () => {
		expect(payloadToProps(fields, { park_name: '', park_code: null, title: '' })).toEqual({});
	});
	it('keeps 0 and false', () => expect(payloadToProps(fields, { rating: 0 })).toEqual({ stars: 0 }));
	it('cuts very long text', () => expect(payloadToProps(fields, { park_name: 'x'.repeat(5000) }).title).toHaveLength(2000));
	it('is not fooled by a prototype key', () => {
		const payload = JSON.parse('{"__proto__": {"title": "x"}, "constructor": "y", "park_name": "ok"}');
		const props = payloadToProps(fields, payload);
		expect(props).toEqual({ title: 'ok' });
		expect(({}).title).toBeUndefined();
	});
	it('gives nothing for a payload that is not an object', () => {
		for (const bad of [null, undefined, 'text', 3, true, ['a']]) expect(payloadToProps(fields, bad)).toEqual({});
	});
});

describe('the tile manifest', () => {
	const registry = { name: 'National Parks', description: 'Log your visits to national parks.' };
	it('names the tile after the passport and the card, with a description and a size', () => {
		expect(tileManifest(registry, { cardName: 'Stamp', ...DEFAULT_TILE_SIZE })).toEqual({
			name: 'National Parks: Stamp',
			description: 'Log your visits to national parks.',
			sizing: { width: 176, height: 200, fit: 'both' }
		});
	});
	it('can ask the host not to follow the card\'s content', () =>
		expect(tileManifest(registry, { cardName: 'C', width: 10, height: 20, fit: 'none' }).sizing).toEqual({ width: 10, height: 20, fit: 'none' }));
	it('takes its limits from the published lexicon', () => {
		expect(TILE_LIMITS).toEqual({ name: masl.defs.masl.properties.name.maxGraphemes, description: masl.defs.masl.properties.description.maxGraphemes });
		expect(TILE_LIMITS).toEqual({ name: 100, description: 300 });
	});
	it('leaves out a description the passport lacks', () => expect('description' in tileManifest({ name: 'X' }, { cardName: 'C', width: 1, height: 1 })).toBe(false));
	it('keeps a long name and description within the spec by cutting at a whole character', () => {
		const m = tileManifest({ name: '🌳'.repeat(150), description: 'é'.repeat(400) }, { cardName: 'C', width: 10, height: 10 });
		expect([...new Intl.Segmenter().segment(m.name)].length).toBeLessThanOrEqual(100);
		expect([...new Intl.Segmenter().segment(m.description)].length).toBeLessThanOrEqual(300);
		expect(checkTileManifest(m)).toEqual([]);
	});
	it('passes a good manifest', () => expect(checkTileManifest({ name: 'A', description: 'd', sizing: { width: 1, height: 1 } })).toEqual([]));
	it('needs a name', () => {
		expect(checkTileManifest({})).toContain('name is required');
		expect(checkTileManifest({ name: '  ' })).toContain('name is required');
	});
	it('limits the name and description by characters, not bytes', () => {
		expect(checkTileManifest({ name: '🌳'.repeat(100) })).toEqual([]);
		expect(checkTileManifest({ name: '🌳'.repeat(101) }).join()).toContain('name is longer than 100');
		expect(checkTileManifest({ name: 'A', description: 'x'.repeat(301) }).join()).toContain('description must be text of at most 300');
	});
	it('passes a manifest that asks only to follow its content, since every size is a wish', () => {
		expect(checkTileManifest({ name: 'A', sizing: { fit: 'both' } })).toEqual([]);
		expect(checkTileManifest({ name: 'A', sizing: { width: 100 } })).toEqual([]);
		expect(checkTileManifest({ name: 'A', sizing: { minWidth: 50, maxWidth: 400, minHeight: 50, maxHeight: 400, width: 100, height: 100, fit: 'none' } })).toEqual([]);
	});
	it('needs each size it gives to be a whole number of at least 1', () => {
		for (const key of ['width', 'height', 'minWidth', 'maxHeight']) {
			for (const bad of [0, -3, 5.5, '5', null]) expect(checkTileManifest({ name: 'A', sizing: { [key]: bad } }).join()).toContain(`sizing.${key} must be a whole number`);
		}
	});
	it('limits fit to the values the spec has', () => {
		for (const fit of SIZING_FITS) expect(checkTileManifest({ name: 'A', sizing: { fit } })).toEqual([]);
		expect(checkTileManifest({ name: 'A', sizing: { fit: 'always' } }).join()).toContain('sizing.fit must be one of');
	});
	it('refuses a size key the spec does not have, and a minimum above its maximum', () => {
		expect(checkTileManifest({ name: 'A', sizing: { depth: 3 } }).join()).toContain('unknown key "depth"');
		expect(checkTileManifest({ name: 'A', sizing: { minWidth: 500, maxWidth: 100 } }).join()).toContain('sizing.minWidth is larger than sizing.maxWidth');
	});
	it('needs sizing to be an object', () => {
		for (const sizing of [null, 'big', []]) expect(checkTileManifest({ name: 'A', sizing }).join()).toContain('sizing must be an object');
	});
	it('rejects what is not an object', () => expect(checkTileManifest([])).toEqual(['manifest must be an object']));
});

describe('buildTile', () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tile-test-'));
	afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
	const plugin = () => {
		const dir = path.join(tmp, `p${Math.random().toString(36).slice(2)}`, 'national_parks');
		fs.cpSync(FIXTURE, dir, { recursive: true });
		return dir;
	};

	it('builds the card into a folder of index.html, app.js and manifest.json', async () => {
		const out = path.join(tmp, 'out-a');
		const res = await buildTile(plugin(), { out });
		expect(res.files).toEqual(['app.js', 'index.html', 'manifest.json']);
		const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
		expect(manifest).toEqual({ name: 'National Parks: National park stamp', description: 'Log your visits to national parks.', sizing: { ...DEFAULT_TILE_SIZE, fit: 'both' } });
		expect(checkTileManifest(manifest)).toEqual([]);
		const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
		expect(html).toContain('<script src="app.js"></script>');
		expect(html).toContain('<div id="app"></div>');
		expect(html).not.toMatch(/<(link|img|iframe)[ >]|https?:\/\//i); // everything it needs is in app.js
	}, 60_000);

	it('puts the first sample entry in the tile and asks the host for data over the data protocol', async () => {
		const out = path.join(tmp, 'out-b');
		await buildTile(plugin(), { out });
		const js = fs.readFileSync(path.join(out, 'app.js'), 'utf8');
		expect(js).toContain('Sep 14, 2024');
		expect(js).toContain('Acadia National Park');
		expect(js).toContain('/.well-known/web-tiles/data.js');
		expect(js).toContain('max-content'); // the root is sized to the card, so a host that follows the card's size gets its width
		expect(js).not.toMatch(/localStorage|sessionStorage|indexedDB|XMLHttpRequest|new WebSocket|\bfetch\(/);
	}, 60_000);

	it('asks to be shown at the size it is given', async () => {
		const out = path.join(tmp, 'out-c');
		await buildTile(plugin(), { out, size: { width: 300, height: 400 } });
		expect(JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).sizing).toEqual({ width: 300, height: 400, fit: 'both' });
	}, 60_000);

	it('packs a .tile that a tile reader opens: the page is the root, the script is a resource, the manifest is not', async () => {
		const out = path.join(tmp, 'out-pack');
		const res = await buildTile(plugin(), { out, pack: true });
		expect(res.tilePath).toBe(`${out}.tile`);
		const reader = new CarTileReader(res.tilePath);
		await reader.open();
		try {
			expect(reader.meta.name).toBe('National Parks: National park stamp');
			expect(reader.meta.sizing).toEqual({ ...DEFAULT_TILE_SIZE, fit: 'both' });
			const root = reader.resolvePath('/');
			expect(root.ok).toBe(true);
			expect(root.headers['content-type']).toBe('text/html');
			const read = async (r) => { const chunks = []; for await (const c of r.createReadStream()) chunks.push(c); return Buffer.concat(chunks); };
			expect((await read(root)).equals(fs.readFileSync(path.join(out, 'index.html')))).toBe(true);
			const js = reader.resolvePath('/app.js');
			expect(js.ok).toBe(true);
			expect(js.headers['content-type']).toBe('text/javascript');
			expect((await read(js)).equals(fs.readFileSync(path.join(out, 'app.js')))).toBe(true);
			expect(reader.resolvePath('/manifest.json').ok).toBe(false);
			expect(reader.resolvePath('/nope').status).toBe(404);
		} finally {
			reader.close();
		}
	}, 60_000);

	it('writes no .tile unless asked', async () => {
		const out = path.join(tmp, 'out-nopack');
		const res = await buildTile(plugin(), { out });
		expect(res.tilePath).toBeUndefined();
		expect(fs.existsSync(`${out}.tile`)).toBe(false);
	}, 60_000);

	it('can be built again over its own output', async () => {
		const out = path.join(tmp, 'out-d');
		const dir = plugin();
		await buildTile(dir, { out });
		await expect(buildTile(dir, { out })).resolves.toMatchObject({ files: ['app.js', 'index.html', 'manifest.json'] });
	}, 60_000);

	it('refuses to empty a folder that is not a tile', async () => {
		const out = path.join(tmp, 'precious');
		fs.mkdirSync(out);
		fs.writeFileSync(path.join(out, 'thesis.docx'), 'mine');
		await expect(buildTile(plugin(), { out })).rejects.toThrow('not empty and doesn\'t look like a tile');
		expect(fs.readFileSync(path.join(out, 'thesis.docx'), 'utf8')).toBe('mine');
	});

	it('refuses a card the passport does not have', async () => {
		await expect(buildTile(plugin(), { card: 'nope', out: path.join(tmp, 'out-e') })).rejects.toThrow('has no card "nope"');
	});

	it('refuses a passport that fails the checks', async () => {
		const dir = plugin();
		fs.writeFileSync(path.join(dir, 'cards', 'national_park_stamp.svelte'), '<script>fetch("/x"); let { title } = $props();</script>{title}');
		await expect(buildTile(dir, { out: path.join(tmp, 'out-f') })).rejects.toThrow('fails the passport checks');
		expect(fs.existsSync(path.join(tmp, 'out-f'))).toBe(false);
	});

	it('leaves no build files behind', async () => {
		await buildTile(plugin(), { out: path.join(tmp, 'out-g') });
		expect(fs.existsSync(path.join(ROOT, '.tile-build', 'national_parks-national_park_stamp'))).toBe(false);
	}, 60_000);
});
