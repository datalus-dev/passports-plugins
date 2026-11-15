// What runs inside a card's Web Tile (https://dasl.ing/tiles.html): the payload → card props mapping for data a host
// sends over the data-passing protocol (tp-data). The tile bundles this file, so it imports nothing and uses no Node
// APIs; the build's manifest helpers are in tile.mjs.

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
