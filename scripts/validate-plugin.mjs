#!/usr/bin/env node
// Checks community passports before a human reviews them.
//
//   node scripts/validate-plugin.mjs                  every folder under passports/
//   node scripts/validate-plugin.mjs passports/foo    one folder
//
// Exit code 1 when any plugin has an error. Nothing from a plugin is executed: registry.ts is read as data,
// cards are parsed (not run), sample.json is JSON.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import { parseRegistry } from './lib/registry-literal.mjs';
import {
	ALLOWED_IMPORTS,
	CARD_SLUG_RE,
	COLUMN_RE,
	DAISY_CLASSES,
	DATE_RE,
	FIELD_TYPES,
	FORBIDDEN_ELEMENTS,
	FORBIDDEN_IDENTIFIERS,
	FORBIDDEN_SVELTE_NODES,
	LIMITS,
	PLUGIN_FILES,
	REGISTRY_KEYS,
	REQUIRED_REGISTRY_KEYS,
	SLUG_RE,
	STANDARD_COLUMNS,
	TABLE_RE
} from './lib/spec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadReserved(root = ROOT) {
	const file = path.join(root, 'reserved.json');
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

/** Visit every node (anything object-shaped with a `type`) under `node`. */
function walk(node, visit, parent = null, key = null) {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const n of node) walk(n, visit, parent, key);
		return;
	}
	if (typeof node.type === 'string') visit(node, parent, key);
	for (const [k, v] of Object.entries(node)) {
		if (k === 'metadata' || k === 'loc') continue;
		if (v && typeof v === 'object') walk(v, visit, typeof node.type === 'string' ? node : parent, k);
	}
}

function checkCard(file, source, errors) {
	const rel = path.basename(file);
	const err = (msg) => errors.push(`cards/${rel}: ${msg}`);
	if (Buffer.byteLength(source) > LIMITS.cardBytes) err(`is larger than ${LIMITS.cardBytes / 1000} KB`);

	let ast;
	try {
		ast = parse(source, { modern: true });
	} catch (e) {
		err(`does not parse as a Svelte component: ${e.message}`);
		return;
	}

	let hasProps = false;
	const classNames = new Set();
	const seen = new Set();
	const note = (msg) => {
		if (!seen.has(msg)) {
			seen.add(msg);
			err(msg);
		}
	};

	walk(ast, (n, parent, key) => {
		switch (n.type) {
			case 'ImportDeclaration':
				if (!ALLOWED_IMPORTS.includes(n.source.value)) {
					note(`imports "${n.source.value}"; a card may import only ${ALLOWED_IMPORTS.map((s) => `"${s}"`).join(', ')}`);
				}
				break;
			case 'ImportExpression':
				note('dynamic import() is not allowed');
				break;
			case 'ExportNamedDeclaration':
			case 'ExportAllDeclaration':
				if (n.source) note(`re-exports from "${n.source.value}"`);
				break;
			case 'HtmlTag':
				note('{@html} is not allowed');
				break;
			case 'CallExpression':
				if (n.callee?.type === 'Identifier' && n.callee.name === '$props') hasProps = true;
				break;
			case 'Identifier': {
				const isPropName =
					(parent?.type === 'MemberExpression' && key === 'property' && !parent.computed) ||
					(parent?.type === 'Property' && key === 'key' && !parent.computed && !parent.shorthand);
				if (!isPropName && FORBIDDEN_IDENTIFIERS.includes(n.name)) note(`uses \`${n.name}\`; a card only draws its props`);
				break;
			}
			case 'RegularElement':
				if (FORBIDDEN_ELEMENTS.includes(n.name)) note(`<${n.name}> is not allowed`);
				break;
			case 'Attribute':
				if (n.name === 'class' && Array.isArray(n.value)) {
					for (const v of n.value) {
						if (v.type === 'Text') v.data.split(/\s+/).filter(Boolean).forEach((c) => classNames.add(c));
					}
				}
				if (n.name === 'href' && Array.isArray(n.value)) {
					for (const v of n.value) {
						if (v.type === 'Text' && /^\s*javascript:/i.test(v.data)) note('a javascript: link is not allowed');
					}
				}
				break;
			case 'ClassDirective':
				classNames.add(n.name);
				break;
			case 'ClassSelector':
				classNames.add(n.name);
				break;
			case 'PseudoClassSelector':
				if (n.name === 'global') note(':global styles are not allowed');
				break;
			case 'Atrule':
				if (n.name === 'import') note('@import is not allowed');
				break;
			default:
				if (FORBIDDEN_SVELTE_NODES.includes(n.type)) note(`<${n.name ?? n.type}> is not allowed`);
		}
	});

	if (!hasProps) err('must read its data from `$props()`');
	for (const c of classNames) {
		if (DAISY_CLASSES.includes(c)) note(`class "${c}" collides with a DaisyUI class; give it a prefix (for example "np-${c}")`);
	}
}

/**
 * @param {string} dir  a plugin folder (passports/<slug>)
 * @param {{ reserved?: string[] }} [opts]
 * @returns {{ slug: string, errors: string[] }}
 */
export function validatePlugin(dir, { reserved = [] } = {}) {
	const errors = [];
	const folder = path.basename(dir);
	const fail = (msg) => errors.push(msg);

	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return { slug: folder, errors: [`${dir} is not a folder`] };

	// Layout: registry.ts, sample.json, cards/*.svelte and nothing else.
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		if (e.isDirectory() && e.name === 'cards') continue;
		if (e.isFile() && PLUGIN_FILES.includes(e.name)) continue;
		fail(`unexpected ${e.isDirectory() ? 'folder' : 'file'} "${e.name}" (a plugin has registry.ts, sample.json and cards/)`);
	}
	for (const f of PLUGIN_FILES) if (!fs.existsSync(path.join(dir, f))) fail(`missing ${f}`);
	const cardsDir = path.join(dir, 'cards');
	const cardFiles = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir) : [];
	for (const f of cardFiles) if (!f.endsWith('.svelte')) fail(`cards/${f}: only .svelte files belong in cards/`);
	if (!fs.existsSync(path.join(dir, 'registry.ts'))) return { slug: folder, errors };

	// registry.ts as data
	const regSource = fs.readFileSync(path.join(dir, 'registry.ts'), 'utf8');
	if (Buffer.byteLength(regSource) > LIMITS.registryBytes) fail(`registry.ts is larger than ${LIMITS.registryBytes / 1000} KB`);
	const parsed = parseRegistry(regSource);
	if (!parsed.value) return { slug: folder, errors: [...errors, ...parsed.errors.map((m) => `registry.ts: ${m}`)] };
	const reg = parsed.value;
	const r = (msg) => fail(`registry.ts: ${msg}`);

	if (!reg || typeof reg !== 'object' || Array.isArray(reg)) {
		r('must export an object');
		return { slug: folder, errors };
	}
	for (const k of Object.keys(reg)) if (!REGISTRY_KEYS.includes(k)) r(`unknown key "${k}" (allowed: ${REGISTRY_KEYS.join(', ')})`);
	for (const k of REQUIRED_REGISTRY_KEYS) if (!(k in reg)) r(`missing "${k}"`);

	const slug = typeof reg.slug === 'string' ? reg.slug : folder;
	if (typeof reg.slug !== 'string' || !SLUG_RE.test(reg.slug)) r('"slug" must be lowercase letters, digits and underscores, starting with a letter (2 to 32 characters)');
	else {
		if (reg.slug !== folder) r(`"slug" is "${reg.slug}" but the folder is "${folder}"; they must match`);
		if (reserved.includes(reg.slug)) r(`"${reg.slug}" is the slug of a core passport or a reserved name`);
	}
	for (const k of ['emoji', 'name', 'description', 'entryName', 'entriesTitle']) {
		if (k in reg && (typeof reg[k] !== 'string' || !reg[k].trim() || reg[k].length > 120)) r(`"${k}" must be a short non-empty string`);
	}
	if ('hasVisibility' in reg && reg.hasVisibility !== true) r('"hasVisibility" must be true (every community passport entry has a visibility)');
	if ('folioName' in reg && reg.folioName !== null) r('"folioName" must be null (folios are not supported yet)');

	if (typeof reg.entryTable !== 'string' || !TABLE_RE.test(reg.entryTable)) r('"entryTable" must be lowercase letters, digits and underscores');
	else if (typeof reg.slug === 'string' && !reg.entryTable.startsWith(`${reg.slug}_`)) r(`"entryTable" must start with "${reg.slug}_"`);

	// fields
	const columns = new Map();
	if (!Array.isArray(reg.fields) || reg.fields.length === 0) r('"fields" must be a non-empty list');
	else {
		if (reg.fields.length > LIMITS.fields) r(`at most ${LIMITS.fields} fields`);
		reg.fields.forEach((f, i) => {
			const w = `fields[${i}]`;
			if (!f || typeof f !== 'object' || Array.isArray(f)) return r(`${w} must be an object`);
			for (const k of Object.keys(f)) if (!['column', 'label', 'type', 'required', 'options', 'card'].includes(k)) r(`${w}: unknown key "${k}"`);
			if (typeof f.column !== 'string' || !COLUMN_RE.test(f.column)) return r(`${w}: "column" must be lowercase letters, digits and underscores`);
			if (STANDARD_COLUMNS.includes(f.column)) r(`${w}: "${f.column}" is a standard column every passport already has`);
			if (columns.has(f.column)) r(`${w}: column "${f.column}" is declared twice`);
			columns.set(f.column, f);
			if (typeof f.label !== 'string' || !f.label.trim() || f.label.length > 40) r(`${w}: "label" must be a short non-empty string`);
			if (!FIELD_TYPES.includes(f.type)) r(`${w}: "type" must be one of ${FIELD_TYPES.join(', ')}`);
			if ('required' in f && typeof f.required !== 'boolean') r(`${w}: "required" must be true or false`);
			if (f.type === 'select') {
				if (!Array.isArray(f.options) || f.options.length === 0 || f.options.length > LIMITS.selectOptions || !f.options.every((o) => typeof o === 'string' && o.trim())) {
					r(`${w}: a "select" needs "options", a list of 1 to ${LIMITS.selectOptions} non-empty strings`);
				}
			} else if ('options' in f) r(`${w}: "options" is only for "select" fields`);
			if ('card' in f && (typeof f.card !== 'string' || !COLUMN_RE.test(f.card))) r(`${w}: "card" must be a prop name (letters, digits, underscores)`);
		});
		const props = reg.fields.map((f) => f?.card).filter(Boolean);
		if (new Set(props).size !== props.length) r('two fields feed the same card prop');
	}

	// dateFields must be exactly the date columns
	if ('dateFields' in reg) {
		const dateCols = [...columns.values()].filter((f) => f.type === 'date').map((f) => f.column).sort();
		const listed = Array.isArray(reg.dateFields) ? [...reg.dateFields].sort() : null;
		if (!listed || JSON.stringify(listed) !== JSON.stringify(dateCols)) {
			r(`"dateFields" must list exactly the date fields: ${JSON.stringify(dateCols)}`);
		}
	} else if ([...columns.values()].some((f) => f.type === 'date')) r('"dateFields" must list the date fields');

	// entrySlugs <-> cards
	if (!Array.isArray(reg.entrySlugs) || reg.entrySlugs.length === 0) r('"entrySlugs" must list at least one card');
	else {
		for (const s of reg.entrySlugs) {
			if (typeof s !== 'string' || !CARD_SLUG_RE.test(s)) r(`entry slug ${JSON.stringify(s)} must be lowercase letters, digits and underscores`);
			else if (!cardFiles.includes(`${s}.svelte`)) r(`entry "${s}" has no cards/${s}.svelte`);
		}
		for (const f of cardFiles) {
			if (f.endsWith('.svelte') && !reg.entrySlugs.includes(f.replace(/\.svelte$/, ''))) fail(`cards/${f} is not listed in "entrySlugs"`);
		}
	}

	// cards
	for (const f of cardFiles.filter((x) => x.endsWith('.svelte'))) {
		checkCard(f, fs.readFileSync(path.join(cardsDir, f), 'utf8'), errors);
	}

	// sample.json
	const samplePath = path.join(dir, 'sample.json');
	if (fs.existsSync(samplePath)) {
		const raw = fs.readFileSync(samplePath, 'utf8');
		const s = (msg) => fail(`sample.json: ${msg}`);
		if (Buffer.byteLength(raw) > LIMITS.sampleBytes) s(`is larger than ${LIMITS.sampleBytes / 1000} KB`);
		let rows;
		try {
			rows = JSON.parse(raw);
		} catch (e) {
			s(`is not valid JSON: ${e.message}`);
		}
		if (rows !== undefined) {
			if (!Array.isArray(rows) || rows.length === 0 || rows.length > LIMITS.sample) s(`must be a list of 1 to ${LIMITS.sample} sample rows`);
			else {
				rows.forEach((row, i) => {
					if (!row || typeof row !== 'object' || Array.isArray(row)) return s(`row ${i} must be an object`);
					for (const [k, v] of Object.entries(row)) {
						if (k === 'note') {
							if (typeof v !== 'string') s(`row ${i}: "note" must be text`);
							continue;
						}
						const f = columns.get(k);
						if (!f) {
							s(`row ${i}: "${k}" is not a field`);
							continue;
						}
						if (f.type === 'number' ? typeof v !== 'number' : typeof v !== 'string') s(`row ${i}: "${k}" must be ${f.type === 'number' ? 'a number' : 'text'}`);
						else if (f.type === 'date' && !DATE_RE.test(v)) s(`row ${i}: "${k}" must be a date like 2025-07-15`);
						else if (f.type === 'select' && !f.options?.includes(v)) s(`row ${i}: "${k}" must be one of ${JSON.stringify(f.options)}`);
					}
					for (const f of columns.values()) if (f.required && !(f.column in row)) s(`row ${i}: missing required field "${f.column}"`);
				});
			}
		}
	}

	return { slug, errors };
}

function main() {
	const args = process.argv.slice(2);
	const reserved = loadReserved();
	const dirs = args.length
		? args.map((a) => path.resolve(a))
		: fs.existsSync(path.join(ROOT, 'passports'))
			? fs.readdirSync(path.join(ROOT, 'passports'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(ROOT, 'passports', e.name))
			: [];

	let bad = 0;
	const slugs = new Map();
	for (const dir of dirs) {
		const { slug, errors } = validatePlugin(dir, { reserved });
		if (slugs.has(slug)) errors.push(`slug "${slug}" is also used by ${slugs.get(slug)}`);
		slugs.set(slug, path.relative(ROOT, dir));
		if (errors.length) {
			bad++;
			console.error(`✗ ${path.relative(ROOT, dir)}`);
			for (const e of errors) console.error(`    ${e}`);
		} else console.log(`✓ ${path.relative(ROOT, dir)}`);
	}
	if (!dirs.length) console.log('No plugins found.');
	process.exit(bad ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
