import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loadReserved, validatePlugin } from '../scripts/validate-plugin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A frozen valid plugin the tests mutate. It lives in test/fixtures so the tests don't depend on which plugins
// happen to be in passports/ (a repo with none, or one that renames National Parks, still passes).
const GOOD = path.join(ROOT, 'test', 'fixtures', 'national_parks');
const reserved = loadReserved(ROOT);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plugins-test-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

let n = 0;
/** Copy the good plugin to a temp folder named `slug`, let `edit` change files, validate it. */
function check(edit, slug = 'national_parks', opts = {}) {
	const dir = path.join(tmp, `case${n++}`, slug);
	fs.cpSync(GOOD, dir, { recursive: true });
	const file = (rel) => path.join(dir, rel);
	const read = (rel) => fs.readFileSync(file(rel), 'utf8');
	const write = (rel, s) => {
		fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
		fs.writeFileSync(file(rel), s);
	};
	edit?.({ read, write, file, dir });
	return validatePlugin(dir, { reserved, ...opts }).errors;
}
const CARD = 'cards/national_park_stamp.svelte';
const withCard = (fn) => check(({ read, write }) => write(CARD, fn(read(CARD))));
const withRegistry = (fn) => check(({ read, write }) => write('registry.ts', fn(read('registry.ts'))));
const hasError = (errors, text) => expect(errors.join('\n')).toContain(text);

describe('the National Parks plugin', () => {
	it('passes', () => expect(check()).toEqual([]));
});

describe('cards', () => {
	it('may not import anything but svelte', () => hasError(withCard((s) => `<script>\nimport x from '$lib/secrets';\n${s.replace('<script>', '')}`), 'imports "$lib/secrets"'));
	it('may import svelte', () => expect(withCard((s) => s.replace('<script>', `<script>\n\timport { untrack } from 'svelte';`))).toEqual([]));
	it('may not import the card library (it imports cards from here)', () => hasError(withCard((s) => s.replace('<script>', `<script>\n\timport { StateStamp } from 'passports-cards';`)), 'imports "passports-cards"'));
	it('may not fetch', () => hasError(withCard((s) => s.replace('</script>', 'fetch("/x");\n</script>')), 'uses `fetch`'));
	it('may not touch window or document', () => hasError(withCard((s) => s.replace('</script>', 'const d = document.cookie;\n</script>')), 'uses `document`'));
	it('may not use dynamic import', () => hasError(withCard((s) => s.replace('</script>', 'import("x");\n</script>')), 'dynamic import()'));
	it('may not use {@html}', () => hasError(withCard((s) => s.replace('<p class="np-name">{title}</p>', '{@html title}')), '{@html}'));
	it('may not use :global styles', () => hasError(withCard((s) => s.replace('</style>', ':global(body) { color: red; }\n</style>')), ':global'));
	it('may not @import', () => hasError(withCard((s) => s.replace('<style>', '<style>\n\t@import url("https://x.test/a.css");')), '@import'));
	it('may not use a DaisyUI class name', () => hasError(withCard((s) => s.replace('class="np-card"', 'class="np-card card"')), 'DaisyUI'));
	it('may not use a DaisyUI class name in a selector', () => hasError(withCard((s) => s.replace('</style>', '.badge { color: red; }\n</style>')), 'DaisyUI'));
	it('may not use iframe', () => hasError(withCard((s) => s.replace('</div>\n\n<style>', '<iframe src="https://x.test"></iframe></div>\n\n<style>')), '<iframe>'));
	it('may not use svelte:window', () => hasError(withCard((s) => s.replace('<div class="np-wrap"', '<svelte:window onresize={() => {}} />\n<div class="np-wrap"')), '<svelte:window>'));
	it('may not link to javascript:', () => hasError(withCard((s) => s.replace('<p class="np-name">{title}</p>', '<a href="javascript:alert(1)">{title}</a>')), 'javascript:'));
	it('must read $props()', () => hasError(withCard((s) => s.replace(/let \{[^}]*\} = \$props\(\);/, 'let title = "";')), '$props()'));
	it('must parse', () => hasError(withCard(() => '<div>{#if}</div>'), 'does not parse'));
	it('must be listed in entrySlugs', () => hasError(check(({ write }) => write('cards/extra.svelte', '<script>let { title } = $props();</script>{title}')), 'not listed in "entrySlugs"'));
	it('must exist for each entry slug', () => hasError(withRegistry((s) => s.replace("['national_park_stamp']", "['national_park_stamp', 'missing_card']")), 'no cards/missing_card.svelte'));
});

describe('the manifest', () => {
	const without = (key) => withRegistry((s) => s.replace(new RegExp(`\\t${key}:[^\\n]*\\n`), ''));
	it('needs authors', () => hasError(without('authors'), 'missing "authors"'));
	it('needs a license', () => hasError(without('license'), 'missing "license"'));
	it('may list an author with a link and a DID', () => expect(check()).toEqual([])); // the fixture's author has all three
	it('may list several authors, one with only a name', () =>
		expect(withRegistry((s) => s.replace(/authors: \[[^\n]*\],/, "authors: [{ name: 'Teon', did: 'did:plc:abc123' }, { name: 'Ada' }],"))).toEqual([]));
	it('may use a did:web identifier', () =>
		expect(withRegistry((s) => s.replace(/did: 'did:plc:[a-z0-9]+'/, "did: 'did:web:example.com'"))).toEqual([]));
	it('may name a repository', () => expect(withRegistry((s) => s.replace("license: 'MIT',", "license: 'MIT',\n\trepository: 'https://tangled.org/x/y',"))).toEqual([]));
	it('needs at least one author', () => hasError(withRegistry((s) => s.replace(/authors: \[[^\n]*\],/, 'authors: [],')), '"authors" must be a list'));
	it('rejects an author without a name', () => hasError(withRegistry((s) => s.replace("name: 'Teon L. Brooks', ", '')), 'authors[0]: "name"'));
	it('rejects an unknown author key', () => hasError(withRegistry((s) => s.replace("{ name: 'Teon L. Brooks',", "{ email: 'a@b.c', name: 'Teon L. Brooks',")), 'unknown key "email"'));
	it('rejects an http author link', () => hasError(withRegistry((s) => s.replace('https://teonbrooks.com', 'http://teonbrooks.com')), '"url" must be an https://'));
	it('rejects a bad DID', () => hasError(withRegistry((s) => s.replace(/did: 'did:plc:[a-z0-9]+'/, "did: 'bob'")), '"did" must be'));
	it('rejects a DID method other than plc and web', () => hasError(withRegistry((s) => s.replace(/did: 'did:plc:[a-z0-9]+'/, "did: 'did:key:z6Mk'")), '"did" must be'));
	it('rejects a license that is not on the list', () => hasError(withRegistry((s) => s.replace("'MIT'", "'GPL-3.0-only'")), '"license" must be one of'));
	it('rejects a non-https repository', () => hasError(withRegistry((s) => s.replace("license: 'MIT',", "license: 'MIT',\n\trepository: 'git@x.test:y',")), '"repository" must be an https://'));
});

describe('plots', () => {
	const withPlots = (plot, { fields = true } = {}) =>
		withRegistry((s) => {
			const extra = fields
				? "\n\t\t{ column: 'latitude', label: 'Latitude', type: 'number' },\n\t\t{ column: 'longitude', label: 'Longitude', type: 'number' },\n\t\t{ column: 'visit_date'"
				: "\n\t\t{ column: 'visit_date'";
			return s.replace("\n\t\t{ column: 'visit_date'", extra).replace(/\n\} as const;/, `,\n\tplots: [${plot}]\n} as const;`);
		});
	const MAP = "{ slug: 'park_map', kind: 'map', name: 'Map', lat: 'latitude', lon: 'longitude', label: 'park_name', date: 'visit_date' }";
	it('may declare a map and a globe', () =>
		expect(withPlots(`${MAP}, ${MAP.replace('park_map', 'park_globe').replace("'map'", "'globe'")}`)).toEqual([]));
	it('rejects a kind the app does not draw', () => hasError(withPlots(MAP.replace("'map'", "'sparkline'")), '"kind" must be one of map, globe'));
	it('rejects a column that is not a field', () => hasError(withPlots(MAP.replace("'latitude'", "'lat'")), '"lat" names "lat", which is not a field'));
	it('rejects coordinates that are not numbers', () => hasError(withPlots(MAP.replace("lon: 'longitude'", "lon: 'park_name'")), '"lon" must be a number field'));
	it('rejects a date that is not a date field', () => hasError(withPlots(MAP.replace("date: 'visit_date'", "date: 'park_code'")), '"date" must be a date field'));
	it('needs a position', () => hasError(withPlots("{ slug: 'park_map', kind: 'map', name: 'Map' }"), 'needs "lat"'));
	it('rejects a repeated slug', () => hasError(withPlots(`${MAP}, ${MAP}`), 'used twice'));
	it('rejects an unknown key', () => hasError(withPlots(MAP.replace('}', ", css: 'x' }")), 'unknown key "css"'));
	it('rejects an empty list', () => hasError(withPlots('', { fields: false }), '"plots" must be a list'));
});

describe('filters', () => {
	const withFilters = (filters) => withRegistry((s) => s.replace(/\n\} as const;/, `,\n\tfilters: ${filters}\n} as const;`));
	it('may filter by a text field', () => expect(withFilters("[{ column: 'park_code', label: 'Code' }]")).toEqual([]));
	it('may give choices a label and a default', () =>
		expect(withFilters("[{ column: 'park_code', label: 'Code', options: { np: 'National Park', nm: 'Monument' }, default: 'np' }]")).toEqual([]));
	it('rejects a column that is not a field', () => hasError(withFilters("[{ column: 'venue', label: 'Venue' }]"), '"venue" is not a field'));
	it('rejects a date column', () => hasError(withFilters("[{ column: 'visit_date', label: 'When' }]"), 'must be a text, select, number field'));
	it('rejects a repeated column', () => hasError(withFilters("[{ column: 'park_code', label: 'A' }, { column: 'park_code', label: 'B' }]"), '"park_code" is filtered twice'));
	it('rejects a missing label', () => hasError(withFilters("[{ column: 'park_code' }]"), '"label" must be a short'));
	it('rejects an empty options map', () => hasError(withFilters("[{ column: 'park_code', label: 'Code', options: {} }]"), '"options" must be 1 to 30'));
	it('rejects an unknown key', () => hasError(withFilters("[{ column: 'park_code', label: 'Code', sql: 'x' }]"), 'unknown key "sql"'));
	it('rejects more than three filters', () =>
		hasError(withFilters("[{ column: 'park_code', label: 'A' }, { column: 'park_name', label: 'B' }, { column: 'park_code', label: 'C' }, { column: 'park_name', label: 'D' }]"), '"filters" must be a list of 1 to 3'));
	it('rejects an empty list', () => hasError(withFilters('[]'), '"filters" must be a list'));
});

describe('source', () => {
	const withSource = (source) => withRegistry((s) => s.replace(/\n\} as const;/, `,\n\tsource: ${source}\n} as const;`));
	const src = (extra = '', map = "park_name: 'name', visit_date: 'visitedOn'") =>
		`{ kind: 'pds', collection: 'app.example.park', map: { ${map} }${extra} }`;
	it('may read a collection from the PDS', () => expect(withSource(src())).toEqual([]));
	it('may default and type a mapped value', () =>
		expect(withSource(src('', "park_name: { path: 'name', default: '' }, park_code: { path: 'code', type: 'text' }, visit_date: 'visitedOn'"))).toEqual([]));
	it('may derive a column', () =>
		expect(withSource(src(", derive: { park_code: { when: 'a.b', equals: 'x', then: 'y', else: 'z' } }"))).toEqual([]));
	it('may give entries a place', () =>
		expect(withSource(src(", place: { column: 'park_code', from: 'park_name', category: 'venue' }"))).toEqual([]));
	it('rejects a kind the app does not read', () => hasError(withSource(src().replace("'pds'", "'feed'")), '"kind" must be one of pds'));
	it('rejects a collection that is not an NSID', () => hasError(withSource(src().replace('app.example.park', 'parks')), 'must be an NSID'));
	it('rejects a mapped column that is not a field', () => hasError(withSource(src('', "color: 'color'")), 'source.map.color: "color" is not a field'));
	it('rejects a path that is not dotted names', () => hasError(withSource(src('', "park_name: 'name[0]'")), 'must be a dotted record path'));
	it('rejects a map that is empty', () => hasError(withSource(src('', '')), '"map" must list'));
	it('rejects an unknown type', () => hasError(withSource(src('', "park_name: { path: 'name', type: 'float' }")), '"type" must be one of'));
	it('rejects an unknown key', () => hasError(withSource(src(', poll: 5')), 'unknown key "poll"'));
	it('may link a blob into a text field', () => expect(withSource(src('', "park_name: { path: 'photo', type: 'blob' }"))).toEqual([]));
	it('may link a list of blobs, looking inside each item', () => expect(withSource(src('', "park_name: { path: 'embed.images', type: 'blobs', of: 'image' }"))).toEqual([]));
	it('rejects `of` on anything but a list of blobs', () => hasError(withSource(src('', "park_name: { path: 'photo', type: 'blob', of: 'image' }")), '"of" is a dotted path inside each item, and only for type blobs'));
	it('rejects a blob column that is not a text field', () => hasError(withSource(src('', "visit_date: { path: 'photo', type: 'blob' }")), 'a blob column must be a text field, but "visit_date" is date'));
	it('rejects a derive that is also mapped', () =>
		hasError(withSource(src(", derive: { park_name: { when: 'a', equals: 'b', then: 'c', else: 'd' } }")), 'source.derive.park_name: is also in "map"'));
	it('rejects a derive rule with a missing branch', () =>
		hasError(withSource(src(", derive: { park_code: { when: 'a', equals: 'b', then: 'c' } }")), '"else" must be text'));
	it('rejects a place that reads a column that is not mapped', () =>
		hasError(withSource(src(", place: { column: 'park_code', from: 'park_code', category: 'venue' }")), 'source.place: "from" must be a mapped column, but "park_code" is not'));
	it('rejects a place column that is also mapped', () =>
		hasError(withSource(src(", place: { column: 'park_name', from: 'park_name', category: 'venue' }")), 'source.place: "park_name" is also in "map"'));
	it('rejects a place category that is not a plain name', () =>
		hasError(withSource(src(", place: { column: 'park_code', from: 'park_name', category: 'a b' }")), '"category" must be a plain name'));
});

describe('tables', () => {
	// A passport always gets a table generated from its fields. Reading a table that already exists is decided by the
	// app, which keeps that list itself (src/lib/adopted-passports.ts), so nothing here can claim it.
	it('cannot be adopted by a registry', () =>
		hasError(withRegistry((s) => s.replace('hasVisibility: true,', "hasVisibility: true,\n\tadopt: { conflictKey: 'user_id,id' },")), 'unknown key "adopt"'));
	it('must be named after the passport', () => hasError(withRegistry((s) => s.replace('national_parks_visits', 'existing_table')), '"entryTable" must start with "national_parks_"'));
	it('may not declare a standard column as a field', () =>
		hasError(withRegistry((s) => s.replace("{ column: 'park_code'", "{ column: 'atproto_uri', label: 'Link', type: 'text' },\n\t\t{ column: 'park_code'")), 'standard column'));
	it('may not use a core passport\'s slug', () =>
		hasError(check(({ read, write }) => write('registry.ts', read('registry.ts').replace("slug: 'national_parks'", "slug: 'beacon_bits'").replace('national_parks_visits', 'beacon_bits_visits')), 'beacon_bits'), 'core passport or a reserved name'));
});

describe('registry.ts', () => {
	it('may not import', () => hasError(withRegistry((s) => `import x from './x';\n${s}`), 'only `export default'));
	it('may not call functions', () => hasError(withRegistry((s) => s.replace("name: 'National Parks'", "name: String('National Parks')")), 'only literal values'));
	it('may not spread', () => hasError(withRegistry((s) => s.replace('hasVisibility: true,', 'hasVisibility: true,\n\t...other,')), 'only `key: value`'));
	it('may not set cache or atproto keys', () => hasError(withRegistry((s) => s.replace('hasVisibility: true,', "hasVisibility: true,\n\tcache: { columns: ['id'] },")), 'unknown key "cache"'));
	it('slug must match the folder', () => hasError(check(null, 'other_name'), 'must match'));
	it('slug may not be a core passport', () => hasError(withRegistry((s) => s.replace("slug: 'national_parks'", "slug: 'travel'")), 'core passport'));
	it('entryTable must start with the slug', () => hasError(withRegistry((s) => s.replace("'national_parks_visits'", "'visits'")), 'must start with "national_parks_"'));
	it('entryTable must be a safe identifier', () => hasError(withRegistry((s) => s.replace("'national_parks_visits'", "'national_parks_x; drop table y'")), '"entryTable"'));
	it('a field may not be a standard column', () => hasError(withRegistry((s) => s.replace("column: 'park_code'", "column: 'visibility'")), 'standard column'));
	it('a field column must be a safe identifier', () => hasError(withRegistry((s) => s.replace("column: 'park_code'", "column: 'Park Code'")), '"column"'));
	it('a field column may not repeat', () => hasError(withRegistry((s) => s.replace("column: 'park_code'", "column: 'park_name'")), 'declared twice'));
	it('a field type must be known', () => hasError(withRegistry((s) => s.replace("type: 'date'", "type: 'sql'")), '"type" must be one of'));
	it('a select needs options', () => hasError(withRegistry((s) => s.replace("type: 'date'", "type: 'select'")), '"select" needs "options"'));
	it('dateFields must list exactly the date fields', () => hasError(withRegistry((s) => s.replace("dateFields: ['visit_date']", 'dateFields: []')), '"dateFields" must list exactly'));
	it('two fields may not feed one card prop', () => hasError(withRegistry((s) => s.replace("card: 'code'", "card: 'title'")), 'same card prop'));
});

describe('the folder', () => {
	it('may not hold other files', () => hasError(check(({ write }) => write('evil.js', 'process.exit(1)')), 'unexpected file "evil.js"'));
	it('may not hold other folders', () => hasError(check(({ write }) => write('scripts/run.sh', 'x')), 'unexpected folder "scripts"'));
	it('needs sample.json', () => hasError(check(({ dir }) => fs.rmSync(path.join(dir, 'sample.json'))), 'missing sample.json'));
	it('sample rows may only use declared fields', () => hasError(check(({ write }) => write('sample.json', '[{"park_name":"A","ghost":"x"}]')), '"ghost" is not a field'));
	it('sample rows need required fields', () => hasError(check(({ write }) => write('sample.json', '[{"park_code":"A"}]')), 'missing required field "park_name"'));
	it('sample dates must be dates', () => hasError(check(({ write }) => write('sample.json', '[{"park_name":"A","visit_date":"yesterday"}]')), 'must be a date'));
});
