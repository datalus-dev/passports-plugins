// Preview of every plugin's cards, drawn from its sample.json. `npm run preview` (port 5195).
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { parseRegistry } from './scripts/lib/registry-literal.mjs';

const ROOT = import.meta.dirname;

function plugins() {
	const virtualId = 'virtual:plugins';
	return {
		name: 'plugins-data',
		resolveId: (id) => (id === virtualId ? `\0${virtualId}` : null),
		load(id) {
			if (id !== `\0${virtualId}`) return null;
			const dir = path.join(ROOT, 'passports');
			const list = fs
				.readdirSync(dir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => {
					const reg = parseRegistry(fs.readFileSync(path.join(dir, e.name, 'registry.ts'), 'utf8')).value;
					const sample = JSON.parse(fs.readFileSync(path.join(dir, e.name, 'sample.json'), 'utf8'));
					return { folder: e.name, registry: reg, sample };
				});
			return `export default ${JSON.stringify(list)};`;
		}
	};
}

export default defineConfig({
	root: path.join(ROOT, 'preview'),
	server: { port: 5195, strictPort: true, fs: { allow: [ROOT] } },
	plugins: [plugins(), svelte()]
});
