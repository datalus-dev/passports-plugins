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
function check(edit, slug = 'national_parks') {
	const dir = path.join(tmp, `case${n++}`, slug);
	fs.cpSync(GOOD, dir, { recursive: true });
	const file = (rel) => path.join(dir, rel);
	const read = (rel) => fs.readFileSync(file(rel), 'utf8');
	const write = (rel, s) => {
		fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
		fs.writeFileSync(file(rel), s);
	};
	edit?.({ read, write, file, dir });
	return validatePlugin(dir, { reserved }).errors;
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
