import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loadReserved, validatePlugin } from '../scripts/validate-plugin.mjs';
import { parseCsv } from '../scripts/lib/csv.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A frozen valid plugin with a dataset, a lookup field and progress plots; the tests mutate a copy of it.
const GOOD = path.join(ROOT, 'test', 'fixtures', 'lookup');
const reserved = loadReserved(ROOT);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plugins-datasets-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

let n = 0;
function check(edit) {
	const dir = path.join(tmp, `case${n++}`, 'national_parks');
	fs.cpSync(GOOD, dir, { recursive: true });
	const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
	const write = (rel, s) => {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), s);
	};
	edit?.({ read, write, dir });
	return validatePlugin(dir, { reserved }).errors;
}
const withRegistry = (fn) => check(({ read, write }) => write('registry.ts', fn(read('registry.ts'))));
const withCsv = (fn) => check(({ read, write }) => write('data/parks.csv', fn(read('data/parks.csv'))));
const hasError = (errors, text) => expect(errors.join('\n')).toContain(text);
const swap = (from, to) => (s) => {
	expect(s, `the fixture should contain ${from}`).toContain(from);
	return s.replace(from, to);
};

describe('a plugin with a dataset, a lookup and progress plots', () => {
	it('passes', () => expect(check()).toEqual([]));
});

describe('csv', () => {
	it('reads commas, quotes and doubled quotes', () => {
		const { rows, errors } = parseCsv('a,b,c\n1,"x, y","say ""hi"""\n');
		expect(errors).toEqual([]);
		expect(rows).toEqual([['a', 'b', 'c'], ['1', 'x, y', 'say "hi"']]);
	});
	it('refuses a cell that spans lines', () => expect(parseCsv('a,b\n1,"x\ny"\n').errors.join()).toContain('not closed'));
	it('refuses text after a closing quote', () => expect(parseCsv('a\n"x"y\n').errors.join()).toContain('after a closing quote'));
});

describe('datasets', () => {
	it('may not set a license key (the credit says where the data came from, nothing more)', () => hasError(withRegistry(swap("note: 'Public domain' }", "note: 'Public domain', license: 'MIT' }")), 'unknown key "license"'));
	it('needs a credit', () => hasError(withRegistry(swap(",\n\t\t\tcredit: { name: 'nps.gov', url: 'https://www.nps.gov/aboutus/national-park-system.htm', note: 'Public domain' }", '')), '"credit" must be'));
	it('credit link must be https', () => hasError(withRegistry(swap('https://www.nps.gov/aboutus', 'http://www.nps.gov/aboutus')), '"url" must be an https:// link'));
	it('file must stay in the passport\'s data folder', () => hasError(withRegistry(swap("file: 'data/parks.csv'", "file: '../parks.csv'")), "inside the passport's data/ folder"));
	it('file must exist', () => hasError(withRegistry(swap("file: 'data/parks.csv'", "file: 'data/other.csv'")), 'data/other.csv does not exist'));
	it('key must be one of its columns', () => hasError(withRegistry(swap("key: 'name'", "key: 'nope'")), '"key" must be one of'));
	it('table name may not be the entry table\'s', () => hasError(withRegistry(swap("slug: 'parks',", "slug: 'visits',")), "is the entry table's"));
	it('every csv in data/ must belong to a dataset', () => hasError(check(({ write }) => write('data/extra.csv', 'a\n1\n')), 'not used by any dataset'));
	it('data/ holds only csv files', () => hasError(check(({ write }) => write('data/readme.txt', 'x')), 'only .csv files belong in data/'));
	it('first line must be the columns', () => hasError(withCsv(swap('code,name,label,state', 'code,name,state,label')), 'the first line must be the columns'));
	it('keys must be unique', () => hasError(withCsv((s) => `${s}XXXX,Acadia National Park,Acadia National Park,Maine\n`), 'keys must be unique'));
	it('keys may not be empty', () => hasError(withCsv((s) => `${s}XXXX,,x,Maine\n`), 'is empty'));
	it('every row needs every cell', () => hasError(withCsv((s) => `${s}XXXX,Foo\n`), 'has 2 cells'));
	it('cells may not hold < or >', () => hasError(withCsv((s) => `${s}XXXX,Foo,<b>x,Maine\n`), 'a < or >'));
	it('a quote must be closed', () => hasError(withCsv((s) => `${s}XXXX,"Foo,x,Maine\n`), 'not closed'));
	it('has a row limit', () => hasError(withCsv((s) => s + Array.from({ length: 1001 }, (_, i) => `K${i},Park ${i},Park ${i},Maine`).join('\n') + '\n'), 'must have 1 to 1000 rows'));
});

describe('lookup fields', () => {
	const LOOKUP_FIELD = "dataset: 'parks', show";
	it('need a dataset', () => hasError(withRegistry(swap(LOOKUP_FIELD, 'show')), 'needs "dataset"'));
	it('need a dataset the passport declares', () => hasError(withRegistry(swap(LOOKUP_FIELD, "dataset: 'nope', show")), 'needs "dataset"'));
	it('show must be a column of the dataset', () => hasError(withRegistry(swap("show: 'label'", "show: 'nope'")), '"show" names "nope"'));
	it('find must be a list', () => hasError(withRegistry(swap("find: ['label', 'name', 'code', 'state']", "find: 'label'")), '"find" must be a list'));
	it('fill must name a field', () => hasError(withRegistry(swap("fill: { park_code: 'code', park_label: 'label' }", "fill: { ghost: 'code' }")), 'not a field'));
	it('fill can only set a text field', () => hasError(withRegistry(swap("fill: { park_code: 'code', park_label: 'label' }", "fill: { visit_date: 'code' }")), 'can only set a text field'));
	it('fill must take a column of the dataset', () => hasError(withRegistry(swap("park_code: 'code'", "park_code: 'nope'")), 'is not a column of dataset'));
	it('dataset is only for lookup fields', () => hasError(withRegistry(swap("type: 'text', card: 'code'", "type: 'text', dataset: 'parks', card: 'code'")), '"dataset" is only for "lookup" fields'));
	it('a sample row must pick a park from the dataset', () =>
		hasError(check(({ write }) => write('sample.json', JSON.stringify([{ park_name: 'Nowhere National Park', visit_date: '2024-01-01' }]))), 'must be a name from data/parks.csv'));
});

describe('progress plots', () => {
	it('look must be ring or grid', () => hasError(withRegistry(swap("look: 'ring'", "look: 'pie'")), '"look" must be one of ring, grid'));
	it('count must be a lookup field', () => hasError(withRegistry(swap("count: 'park_name', of: 'parks', size: 'half'", "count: 'park_code', of: 'parks', size: 'half'")), '"count" must be a lookup field'));
	it('of must be the lookup\'s dataset', () => hasError(withRegistry(swap("of: 'parks', size: 'half'", "of: 'other', size: 'half'")), '"of" must be "parks"'));
	it('label must be a column of the dataset', () => hasError(withRegistry(swap("label: 'code'", "label: 'nope'")), '"label" must be a column of dataset'));
	it('is not drawn at a place', () => hasError(withRegistry(swap("look: 'ring',", "look: 'ring', lat: 'visit_date',")), '"lat" is not for a progress chart'));
	it('look belongs to progress charts only', () => hasError(withRegistry(swap("kind: 'progress', name: 'Progress ring'", "kind: 'map', name: 'Progress ring'")), '"look" is only for a progress chart'));
});
