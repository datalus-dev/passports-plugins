// Web Tiles (https://dasl.ing/tiles.html): a card built as a tile is a small web page that carries everything it needs,
// has no network, and gets its data from whatever embeds it over the data-passing protocol (tp-data). This file is what
// the build and the tile itself share: the payload → card props mapping (it runs inside the tile, so no Node APIs
// here) and the checks on the manifest the build writes (it runs in the build).

const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;
const MAX_TEXT = 2000;

/** "2024-09-14" → "Sep 14, 2024"; the date is read as written, with no time zone shift. Anything else comes back as it is. */
export function formatTileDate(value) {
	const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
	if (!m) return value;
	const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
	if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1) return value;
	return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** What a card may be given: plain text, numbers and booleans. Anything else a host sends (objects, functions) is dropped. */
function plain(value) {
	if (typeof value === 'string') return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) : value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'boolean') return value;
	return null;
}

/**
 * The card's props for what a host sent. A payload is either an entry, keyed by the passport's columns
 * (`{ park_name: 'Acadia', visit_date: '2024-09-14' }`), or the card's props themselves (`{ title: 'Acadia' }`); keys of
 * both kinds can be mixed, and a column wins over a prop of the same name. A `date` column is shown as text, like the
 * app does. Keys that are neither a column nor a card prop, and values that aren't plain, are ignored.
 *
 * @param {{ column: string, type: string, card?: string }[]} fields  the passport's `fields`
 * @param {unknown} payload
 * @returns {Record<string, string | number | boolean>}
 */
export function payloadToProps(fields, payload) {
	const props = {};
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return props;
	const cardProps = new Set(fields.map((f) => f.card).filter(Boolean));
	const entry = /** @type {Record<string, unknown>} */ (payload);
	for (const key of Object.keys(entry)) {
		if (!SAFE_KEY.test(key) || !cardProps.has(key)) continue;
		const v = plain(entry[key]);
		if (v != null && v !== '') props[key] = v;
	}
	for (const f of fields) {
		if (!f.card || !Object.hasOwn(entry, f.column)) continue;
		const v = plain(entry[f.column]);
		if (v == null || v === '') delete props[f.card];
		else props[f.card] = f.type === 'date' ? formatTileDate(v) : v;
	}
	return props;
}

// ── the manifest ───────────────────────────────────────────────────────────────────────────────────────

const graphemes = (s) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length;

export const TILE_LIMITS = { name: 100, description: 300 };

/**
 * The manifest a tile's source folder carries (manifest.json beside index.html). `resources` isn't in it: the tools
 * that pack the tile (`atile bundle`) fill it in from the folder's files.
 *
 * @param {{ name: string, description?: string }} registry
 * @param {{ cardName: string, width: number, height: number }} opts
 */
export function tileManifest(registry, { cardName, width, height }) {
	const clip = (s, max) => (graphemes(s) <= max ? s : [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].slice(0, max - 1).map((x) => x.segment).join('') + '…');
	const manifest = { name: clip(`${registry.name}: ${cardName}`, TILE_LIMITS.name) };
	if (registry.description) manifest.description = clip(registry.description, TILE_LIMITS.description);
	manifest.sizing = { width, height };
	return manifest;
}

/** Every problem with a tile manifest against the spec's limits (the `ing.dasl.masl` lexicon). Empty when it is fine. */
export function checkTileManifest(m) {
	const problems = [];
	if (!m || typeof m !== 'object' || Array.isArray(m)) return ['manifest must be an object'];
	if (typeof m.name !== 'string' || !m.name.trim()) problems.push('name is required');
	else if (graphemes(m.name) > TILE_LIMITS.name) problems.push(`name is longer than ${TILE_LIMITS.name} characters`);
	if ('description' in m && (typeof m.description !== 'string' || graphemes(m.description) > TILE_LIMITS.description)) {
		problems.push(`description must be text of at most ${TILE_LIMITS.description} characters`);
	}
	if ('sizing' in m) {
		const s = m.sizing;
		const whole = (n) => Number.isInteger(n) && n >= 1;
		if (!s || typeof s !== 'object' || !whole(s.width) || !whole(s.height)) problems.push('sizing needs a width and a height, both whole numbers of at least 1');
	}
	return problems;
}

/** The size a card is shown at when the author doesn't say: the card's box plus room for its shadow. */
export const DEFAULT_TILE_SIZE = { width: 176, height: 200 };
