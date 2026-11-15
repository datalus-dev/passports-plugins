#!/usr/bin/env node
// Builds a passport's card as a Web Tile (https://dasl.ing/tiles.html): a folder with index.html, app.js and
// manifest.json that carries everything the card needs and talks to whatever embeds it over the data-passing protocol.
//
//   node scripts/build-tile.mjs passports/national_parks                   the first card
//   node scripts/build-tile.mjs passports/national_parks --card <entry>    another card
//   node scripts/build-tile.mjs passports/national_parks --size 176x200    the size the tile is designed for
//   node scripts/build-tile.mjs passports/national_parks --fit none        don't ask the host to follow the card's size (default: both)
//   node scripts/build-tile.mjs passports/national_parks --pack            also write <folder>.tile, ready to hand to a tile reader
//   node scripts/build-tile.mjs passports/national_parks --out ./my-tile   somewhere else (default dist-tiles/<slug>/<card>)
//
// The folder is what `atile publish -s <folder>` publishes; it holds no `resources` list because that tool (and
// @dasl/tile-writer, which --pack uses) fills it in. The card is compiled, never run here, and the passport is checked
// by the same rules as in CI first.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { loadReserved, validatePlugin } from './validate-plugin.mjs';
import { parseRegistry } from './lib/registry-literal.mjs';
import TileWriter from '@dasl/tile-writer';
import { DEFAULT_TILE_FIT, DEFAULT_TILE_SIZE, SIZING_FITS, checkTileManifest, payloadToProps, tileManifest } from './lib/tile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TILE_RUNTIME = path.join(ROOT, 'scripts', 'lib', 'tile-runtime.mjs');

const humanize = (slug) => slug.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The folder a build may empty: missing, empty, or already a tile (it has the manifest and page a build writes). */
function checkOutDir(dir) {
	if (!fs.existsSync(dir)) return;
	const names = fs.readdirSync(dir);
	if (names.length && !(names.includes('manifest.json') && names.includes('index.html'))) {
		throw new Error(`${dir} is not empty and doesn't look like a tile; choose another --out so nothing of yours is deleted.`);
	}
}

/** Pack a built tile folder into a `.tile` (a CAR with the manifest in its header): index.html is the root, and the manifest isn't a resource. */
async function packTile(outDir, manifest, file) {
	const writer = new TileWriter({ ...manifest });
	writer.addResource('/', { 'content-type': 'text/html' }, { path: path.join(outDir, 'index.html') });
	writer.addResource('/app.js', { 'content-type': 'text/javascript' }, { path: path.join(outDir, 'app.js') });
	await writer.write(file);
	return file;
}

/**
 * @param {string} pluginDir  a passport folder (passports/<slug>)
 * @param {{ card?: string, out?: string, size?: { width: number, height: number }, fit?: string, pack?: boolean }} [opts]
 */
export async function buildTile(pluginDir, { card, out, size = DEFAULT_TILE_SIZE, fit = DEFAULT_TILE_FIT, pack = false } = {}) {
	const dir = path.resolve(pluginDir);
	const { errors } = validatePlugin(dir, { reserved: loadReserved(ROOT) });
	if (errors.length) throw new Error(`${path.basename(dir)} fails the passport checks:\n  ${errors.join('\n  ')}`);

	const registry = parseRegistry(fs.readFileSync(path.join(dir, 'registry.ts'), 'utf8')).value;
	const entry = card ?? registry.entrySlugs[0];
	if (!registry.entrySlugs.includes(entry)) throw new Error(`${registry.slug} has no card "${entry}" (it has ${registry.entrySlugs.join(', ')})`);

	const sample = JSON.parse(fs.readFileSync(path.join(dir, 'sample.json'), 'utf8'))[0];
	const defaults = payloadToProps(registry.fields, sample);
	const manifest = tileManifest(registry, { cardName: humanize(entry), width: size.width, height: size.height, fit });
	const problems = checkTileManifest(manifest);
	if (problems.length) throw new Error(`The tile manifest is not valid:\n  ${problems.join('\n  ')}`);

	const outDir = path.resolve(out ?? path.join(ROOT, 'dist-tiles', registry.slug, entry));
	checkOutDir(outDir);

	// The page the card is mounted in: it shows the first sample entry until a host sends one, then draws whatever it sends.
	const work = path.join(ROOT, '.tile-build', `${registry.slug}-${entry}`);
	fs.rmSync(work, { recursive: true, force: true });
	fs.mkdirSync(work, { recursive: true });
	fs.writeFileSync(
		path.join(work, 'Tile.svelte'),
		`<script>
	import { onMount } from 'svelte';
	import Card from ${JSON.stringify(path.join(dir, 'cards', `${entry}.svelte`))};
	import { payloadToProps } from ${JSON.stringify(TILE_RUNTIME)};

	const FIELDS = ${JSON.stringify(registry.fields.map(({ column, type, card }) => ({ column, type, card })))};
	let props = $state(${JSON.stringify(defaults)});

	// The data-passing protocol (tp-data): the host sends an entry or the card's props; each one replaces what is shown.
	onMount(() => {
		const protocol = '/.well-known/web-tiles/data.js';
		import(/* @vite-ignore */ protocol)
			.then(({ addDataHandler, listen }) => {
				addDataHandler((payload) => { props = payloadToProps(FIELDS, payload); });
				listen();
			})
			.catch(() => {});
	});
</script>

<div class="tile"><Card {...props} variant="full" /></div>

<style>
	:global(html), :global(body) { margin: 0; background: transparent; }
	/* The host measures the root to follow the card's size (tp-size), so size it to its content: a root as wide as the frame would always report the frame's width. */
	:global(html) { width: max-content; }
	.tile { display: inline-flex; padding: 12px; }
</style>
`
	);
	fs.writeFileSync(
		path.join(work, 'main.js'),
		`import { mount } from 'svelte';\nimport Tile from './Tile.svelte';\nmount(Tile, { target: document.getElementById('app') });\n`
	);

	try {
		await build({
			configFile: false,
			root: ROOT,
			logLevel: 'warn',
			plugins: [svelte({ configFile: false, compilerOptions: { css: 'injected' } })],
			build: {
				outDir,
				emptyOutDir: true,
				lib: { entry: path.join(work, 'main.js'), formats: ['iife'], name: 'Tile', fileName: () => 'app.js' },
				rollupOptions: { external: ['/.well-known/web-tiles/data.js'] }
			}
		});
	} finally {
		fs.rmSync(work, { recursive: true, force: true });
	}

	fs.writeFileSync(
		path.join(outDir, 'index.html'),
		`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.name)}</title></head><body><div id="app"></div><script src="app.js"></script></body></html>\n`
	);
	fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
	const tilePath = pack ? await packTile(outDir, manifest, `${outDir}.tile`) : undefined;
	return { outDir, manifest, files: fs.readdirSync(outDir).sort(), tilePath };
}

async function main() {
	const args = process.argv.slice(2);
	const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
	const dir = args.find((a, i) => !a.startsWith('--') && !['--card', '--out', '--size', '--fit'].includes(args[i - 1] ?? ''));
	if (!dir) {
		console.error('usage: node scripts/build-tile.mjs <passport folder> [--card <entry>] [--size 176x200] [--fit none|width|height|both] [--pack] [--out <folder>]');
		process.exit(2);
	}
	let size;
	if (flag('--size')) {
		const m = /^(\d{1,4})x(\d{1,4})$/.exec(flag('--size'));
		if (!m || Number(m[1]) < 1 || Number(m[2]) < 1) {
			console.error('--size must look like 176x200');
			process.exit(2);
		}
		size = { width: Number(m[1]), height: Number(m[2]) };
	}
	const fit = flag('--fit');
	if (fit && !SIZING_FITS.includes(fit)) {
		console.error(`--fit must be one of ${SIZING_FITS.join(', ')}`);
		process.exit(2);
	}
	try {
		const { outDir, manifest, files, tilePath } = await buildTile(dir, { card: flag('--card'), out: flag('--out'), size, fit, pack: args.includes('--pack') });
		console.log(`Built "${manifest.name}" (${manifest.sizing.width}x${manifest.sizing.height}, fit ${manifest.sizing.fit}) in ${path.relative(process.cwd(), outDir)}: ${files.join(', ')}`);
		if (tilePath) console.log(`Packed ${path.relative(process.cwd(), tilePath)}`);
		console.log('Publish it with: npx @dasl/atile publish -s <that folder>');
	} catch (err) {
		console.error(err.message);
		process.exit(1);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
