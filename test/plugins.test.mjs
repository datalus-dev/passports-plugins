import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createServer } from 'vite';
import { loadReserved, validatePlugin } from '../scripts/validate-plugin.mjs';
import { parseRegistry } from '../scripts/lib/registry-literal.mjs';

// Every plugin in passports/, with no test written per plugin: a new folder is picked up here. Each one has to pass
// the validator and draw every one of its cards from every one of its sample rows, full and simplified, without throwing.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASSPORTS = path.join(ROOT, 'passports');
const folders = fs.existsSync(PASSPORTS) ? fs.readdirSync(PASSPORTS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
const reserved = loadReserved(ROOT);

let vite;
beforeAll(async () => {
	vite = await createServer({
		root: ROOT,
		configFile: false,
		logLevel: 'silent',
		appType: 'custom',
		server: { middlewareMode: true, hmr: false, watch: null },
		plugins: [svelte({ compilerOptions: { dev: false } })]
	});
});
afterAll(() => vite?.close());

/** A sample row as the host hands it to a card: each field's `card` name gets its value. */
function propsOf(registry, row) {
	const props = {};
	for (const f of registry.fields) if (f.card && row[f.column] != null && row[f.column] !== '') props[f.card] = row[f.column];
	return props;
}

describe.each(folders)('the %s plugin', (folder) => {
	const dir = path.join(PASSPORTS, folder);

	it('passes the validator', () => expect(validatePlugin(dir, { reserved }).errors).toEqual([]));

	const registry = parseRegistry(fs.readFileSync(path.join(dir, 'registry.ts'), 'utf8')).value;
	const sample = JSON.parse(fs.readFileSync(path.join(dir, 'sample.json'), 'utf8'));

	describe.each(registry.entrySlugs)('card %s', (slug) => {
		it.each(['full', 'simplified'])('draws every sample row, %s', async (variant) => {
			const mod = await vite.ssrLoadModule(path.join(dir, 'cards', `${slug}.svelte`));
			for (const row of sample) {
				const { body } = render(mod.default, { props: { ...propsOf(registry, row), variant } });
				expect(body.length, `a sample row drew nothing in ${slug}`).toBeGreaterThan(0);
			}
		});

		it('draws an empty entry', async () => {
			const mod = await vite.ssrLoadModule(path.join(dir, 'cards', `${slug}.svelte`));
			expect(() => render(mod.default, { props: { variant: 'full' } })).not.toThrow();
		});
	});
});
