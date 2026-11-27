// A small valid plugin, written from this file for the tests to copy and break. It is made up (nothing here is a real
// passport or its data), so the tests do not depend on which plugins are in passports/ and no plugin's files are copied.
import fs from 'node:fs';
import path from 'node:path';

const AUTHORS = "[{ name: 'Sample Author', url: 'https://example.org', did: 'did:plc:abcdefghijklmnopqrstuvwx' }]";

const CARD = `<script>
	let { title = '', code = '', date = '', color = '', variant = 'full', font = 'mono', controls, strip } = $props();

	const simple = $derived(variant === 'simplified');
	const family = $derived(font === 'inherit' ? 'inherit' : "var(--ps-font, ui-monospace, monospace)");
</script>

<div class="sc-wrap" style:font-family={family} style:--sc-ink={color || null}>
	<div class="sc-card">
		{#if !simple}{@render controls?.()}{/if}
		<p class="sc-name">{title}</p>
		{#if code}<p class="sc-code">{code}</p>{/if}
		{#if date}<p class="sc-date">{date}</p>{/if}
		{#if !simple}{@render strip?.()}{/if}
	</div>
</div>

<style>
	.sc-wrap {
		width: 9.5rem;
		justify-self: center;
	}

	.sc-card {
		position: relative;
		padding: 0.75rem;
		background: oklch(97% 0.01 85);
		border-radius: 0.5rem;
	}

	.sc-name {
		margin: 0;
		font-weight: 700;
		color: var(--sc-ink, oklch(30% 0.05 150));
	}

	.sc-code,
	.sc-date {
		margin: 0;
		font-size: 0.65rem;
	}
</style>
`;

const BASIC_REGISTRY = `export default {
	slug: 'sample_club',
	emoji: '🧪',
	name: 'Sample Club',
	description: 'A made-up passport for the tests.',
	entryName: 'visit',
	entriesTitle: 'Visits',
	entrySlugs: ['sample_stamp'],
	folioName: null,
	entryTable: 'sample_club_visits',
	hasVisibility: true,
	dateFields: ['visit_date'],

	authors: ${AUTHORS},
	license: 'MIT',

	fields: [
		{ column: 'item_name', label: 'Item', type: 'text', required: true, card: 'title' },
		{ column: 'item_code', label: 'Item code', type: 'text', card: 'code' },
		{ column: 'visit_date', label: 'Visited', type: 'date', card: 'date' }
	]
} as const;
`;

const LOOKUP_REGISTRY = `export default {
	slug: 'sample_club',
	emoji: '🧪',
	name: 'Sample Club',
	description: 'A made-up passport for the tests.',
	entryName: 'visit',
	entriesTitle: 'Visits',
	entrySlugs: ['sample_stamp', 'sample_card'],
	folioName: null,
	entryTable: 'sample_club_visits',
	hasVisibility: true,
	dateFields: ['visit_date'],
	entryColor: true,

	authors: ${AUTHORS},
	license: 'MIT',

	datasets: [
		{
			slug: 'items',
			file: 'data/items.csv',
			key: 'name',
			columns: [{ column: 'code' }, { column: 'name' }, { column: 'label' }, { column: 'group' }],
			credit: { name: 'example.org', url: 'https://example.org/items', note: 'Public domain' }
		}
	],

	fields: [
		{ column: 'item_name', label: 'Item', type: 'lookup', required: true, dataset: 'items', show: 'label', sub: 'group', find: ['label', 'name', 'code', 'group'], fill: { item_code: 'code', item_label: 'label' } },
		{ column: 'item_code', label: 'Item code', type: 'text', card: 'code' },
		{ column: 'item_label', label: 'Item label', type: 'text', card: 'title' },
		{ column: 'visit_date', label: 'Visited', type: 'date', card: 'date' }
	],

	plots: [
		{ slug: 'item_ring', kind: 'progress', name: 'Progress ring', title: 'Items seen', look: 'ring', count: 'item_name', of: 'items', size: 'half' },
		{ slug: 'item_grid', kind: 'progress', name: 'Progress grid', title: 'Items seen', look: 'grid', count: 'item_name', of: 'items', label: 'code', sublabel: 'label', size: 'full' }
	]
} as const;
`;

const CSV = `code,name,label,group
AL,Alpha Item,Alpha Item,North
BR,Bravo Item,Bravo Item,South
CH,Charlie Item,Charlie Item,North
DE,Delta's Item,Delta’s Item,East
`;

const BASIC_SAMPLE = [
	{ item_name: 'Alpha Item', item_code: 'AL', visit_date: '2024-09-14' },
	{ item_name: 'Bravo Item', item_code: 'BR', visit_date: '2023-06-02' },
	{ item_name: 'Charlie Item', item_code: 'CH', visit_date: '2025-03-26' }
];

const LOOKUP_SAMPLE = [
	{ item_name: 'Alpha Item', item_code: 'AL', item_label: 'Alpha Item', visit_date: '2024-09-14' },
	{ item_name: 'Bravo Item', item_code: 'BR', item_label: 'Bravo Item', visit_date: '2023-06-02' },
	{ item_name: "Delta's Item", item_code: 'DE', item_label: 'Delta’s Item', visit_date: '2025-03-26' }
];

/** Writes the sample plugin into `dir`. `lookup: true` adds a dataset, a lookup field, a second card and progress plots. */
export function writeSamplePlugin(dir, { lookup = false } = {}) {
	const put = (rel, text) => {
		fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
		fs.writeFileSync(path.join(dir, rel), text);
	};
	put('registry.ts', lookup ? LOOKUP_REGISTRY : BASIC_REGISTRY);
	put('sample.json', JSON.stringify(lookup ? LOOKUP_SAMPLE : BASIC_SAMPLE, null, '\t') + '\n');
	put('cards/sample_stamp.svelte', CARD);
	if (lookup) {
		put('cards/sample_card.svelte', CARD);
		put('data/items.csv', CSV);
	}
}
