// The build side of a Web Tile (https://dasl.ing/tiles.html): the manifest a tile's source folder carries and the
// checks on it. The limits come from the `ing.dasl.masl` lexicon that DASL publishes (@dasl/tile-lexicon), so they
// can't drift from the spec. What runs inside the tile itself is in tile-runtime.mjs.

import { masl } from '@dasl/tile-lexicon';

export { formatTileDate, payloadToProps } from './tile-runtime.mjs';

const properties = masl.defs.masl.properties;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s) => [...segmenter.segment(s)].length;

/** The longest a tile's name and description may be, in characters, from the lexicon. */
export const TILE_LIMITS = { name: properties.name.maxGraphemes, description: properties.description.maxGraphemes };

/** Which of a tile's dimensions follow its content, measured by the host (tp-size). */
export const SIZING_FITS = ['none', 'width', 'height', 'both'];
const SIZING_KEYS = ['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'fit'];

/** The size a card asks for when the author doesn't say: the card's box plus room for its shadow, and to follow its content. */
export const DEFAULT_TILE_SIZE = { width: 176, height: 200 };
export const DEFAULT_TILE_FIT = 'both';

const clip = (s, max) => (graphemes(s) <= max ? s : [...segmenter.segment(s)].slice(0, max - 1).map((x) => x.segment).join('') + '…');

/**
 * The manifest a tile's source folder carries (manifest.json beside index.html). `resources` isn't in it: the tools
 * that pack a tile (`atile`, or @dasl/tile-writer here) fill it in from the folder's files.
 *
 * The size is a wish a host may ignore: `width` and `height` are what the card is designed for, and `fit` asks a host
 * that supports size negotiation to follow the card's content instead.
 *
 * @param {{ name: string, description?: string }} registry
 * @param {{ cardName: string, width: number, height: number, fit?: string }} opts
 */
export function tileManifest(registry, { cardName, width, height, fit = DEFAULT_TILE_FIT }) {
	const manifest = { name: clip(`${registry.name}: ${cardName}`, TILE_LIMITS.name) };
	if (registry.description) manifest.description = clip(registry.description, TILE_LIMITS.description);
	manifest.sizing = { width, height, fit };
	return manifest;
}

/** Every problem with a tile manifest against the spec (the lexicon's limits and tp-size's sizing). Empty when it is fine. */
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
		if (!s || typeof s !== 'object' || Array.isArray(s)) problems.push('sizing must be an object');
		else {
			for (const k of Object.keys(s)) if (!SIZING_KEYS.includes(k)) problems.push(`sizing has an unknown key "${k}"`);
			for (const k of SIZING_KEYS.filter((k) => k !== 'fit' && k in s)) {
				if (!Number.isInteger(s[k]) || s[k] < 1) problems.push(`sizing.${k} must be a whole number of at least 1`);
			}
			if ('fit' in s && !SIZING_FITS.includes(s.fit)) problems.push(`sizing.fit must be one of ${SIZING_FITS.join(', ')}`);
			for (const [lo, hi] of [['minWidth', 'maxWidth'], ['minHeight', 'maxHeight']]) {
				if (Number.isInteger(s[lo]) && Number.isInteger(s[hi]) && s[lo] > s[hi]) problems.push(`sizing.${lo} is larger than sizing.${hi}`);
			}
		}
	}
	return problems;
}
