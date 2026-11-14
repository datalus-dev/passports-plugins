export default {
	slug: 'national_parks',
	emoji: '🌳',
	name: 'National Parks',
	description: 'Log your visits to national parks.',
	entryName: 'visit',
	entriesTitle: 'Visits',
	entrySlugs: ['national_park_stamp'],
	folioName: null,
	entryTable: 'national_parks_visits',
	hasVisibility: true,
	dateFields: ['visit_date'],

	// The manifest: who made it and under what terms (credited wherever the passport is shown).
	authors: [{ name: 'Teon L. Brooks', url: 'https://teonbrooks.com' }],
	license: 'MIT',

	// Each field is a column in the passport's table, a control in the add and edit forms, and (with `card`)
	// a prop of the card. The note and visibility are on every passport already.
	fields: [
		{ column: 'park_name', label: 'Park', type: 'text', required: true, card: 'title' },
		{ column: 'park_code', label: 'Park code', type: 'text', card: 'code' },
		{ column: 'visit_date', label: 'Visited', type: 'date', card: 'date' }
	]
} as const;
