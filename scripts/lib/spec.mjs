// The rules a community passport must follow. Both CI here and the app's `plugins:sync` read this file,
// so there is one place to change them.

export const FIELD_TYPES = ['text', 'longtext', 'date', 'number', 'select'];

// Columns every passport table gets; a plugin may not declare them as fields.
export const STANDARD_COLUMNS = [
	'id',
	'user_id',
	'visibility',
	'note',
	'image_paths',
	'entry_source',
	'created_at',
	'updated_at',
	'atproto_uri',
	'atproto_cid',
	'atproto_synced_at',
	'atproto_pending'
];

export const SLUG_RE = /^[a-z][a-z0-9_]{1,31}$/;
export const COLUMN_RE = /^[a-z][a-z0-9_]{0,40}$/;
export const TABLE_RE = /^[a-z][a-z0-9_]{1,62}$/;
export const CARD_SLUG_RE = /^[a-z][a-z0-9_]{1,40}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const REGISTRY_KEYS = [
	'slug',
	'emoji',
	'name',
	'description',
	'entryName',
	'entriesTitle',
	'entrySlugs',
	'folioName',
	'entryTable',
	'hasVisibility',
	'dateFields',
	'fields'
];

export const REQUIRED_REGISTRY_KEYS = [
	'slug',
	'emoji',
	'name',
	'description',
	'entryName',
	'entriesTitle',
	'entrySlugs',
	'entryTable',
	'fields'
];

export const LIMITS = { fields: 20, selectOptions: 30, sample: 12, registryBytes: 20_000, cardBytes: 30_000, sampleBytes: 20_000 };

// A card may import only these.
export const ALLOWED_IMPORTS = ['svelte'];

// Browser and runtime globals a card has no business touching: a card draws props, it does not fetch or store.
export const FORBIDDEN_IDENTIFIERS = [
	'fetch',
	'XMLHttpRequest',
	'WebSocket',
	'EventSource',
	'localStorage',
	'sessionStorage',
	'indexedDB',
	'document',
	'window',
	'navigator',
	'location',
	'globalThis',
	'self',
	'eval',
	'Function',
	'process',
	'require'
];

export const FORBIDDEN_ELEMENTS = ['iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'script', 'style'];
export const FORBIDDEN_SVELTE_NODES = ['SvelteHead', 'SvelteWindow', 'SvelteDocument', 'SvelteBody'];

// DaisyUI v5 styles these bare class names everywhere, so a card using one picks up its layout.
export const DAISY_CLASSES = [
	'alert', 'avatar', 'badge', 'breadcrumbs', 'btn', 'card', 'carousel', 'chat', 'checkbox', 'collapse', 'countdown',
	'diff', 'divider', 'dock', 'drawer', 'dropdown', 'fab', 'fieldset', 'file-input', 'filter', 'footer', 'hero',
	'indicator', 'input', 'join', 'kbd', 'label', 'link', 'list', 'loading', 'mask', 'menu', 'modal', 'navbar',
	'pagination', 'progress', 'radio', 'range', 'rating', 'select', 'skeleton', 'stack', 'stat', 'stats', 'status',
	'step', 'steps', 'swap', 'tab', 'table', 'tabs', 'textarea', 'timeline', 'toast', 'toggle', 'tooltip'
];

export const PLUGIN_FILES = ['registry.ts', 'sample.json'];
