export default {
	slug: 'national_parks',
	emoji: '🌳',
	name: 'National Parks',
	description: 'Log your visits to national parks.',
	entryName: 'visit',
	entriesTitle: 'Visits',
	entrySlugs: ['national_park_stamp', 'national_park_card'],
	folioName: null,
	entryTable: 'national_parks_visits',
	hasVisibility: true,
	dateFields: ['visit_date'],

	// The owner picks one color for all of their visits; each card receives it as `color` and keeps its own ink without one.
	entryColor: true,

	// The manifest: who made it and under what terms (credited wherever the passport is shown).
	authors: [{ name: 'Teon L. Brooks', url: 'https://teonbrooks.com', did: 'did:plc:yl7wcldipsfnjdww2jg5mnrv' }],
	license: 'MIT',

	// The 64 National Parks, to pick from. The list is in data/parks.csv and is public domain; the app makes it a read-only
	// table (national_parks_parks) and keeps a copy on the device, so the picker works offline. `name` is NPS's own spelling
	// and is what a visit stores; `label` is what the app shows (the same, with the okina in Hawai'i).
	datasets: [
		{
			slug: 'parks',
			file: 'data/parks.csv',
			key: 'name',
			columns: [{ column: 'code' }, { column: 'name' }, { column: 'label' }, { column: 'state' }],
			credit: { name: 'nps.gov', url: 'https://www.nps.gov/aboutus/national-park-system.htm', note: 'Public domain' }
		}
	],

	// Each field is a column in the passport's table, a control in the add and edit forms, and (with `card`)
	// a prop of the card. The note and visibility are on every passport already.
	// Picking a park fills the code and the display name, so those two fields are not in the form.
	fields: [
		{ column: 'park_name', label: 'Park', type: 'lookup', required: true, dataset: 'parks', show: 'label', sub: 'state', find: ['label', 'name', 'code', 'state'], fill: { park_code: 'code', park_label: 'label' } },
		{ column: 'park_code', label: 'Park code', type: 'text', card: 'code' },
		{ column: 'park_label', label: 'Park label', type: 'text', card: 'title' },
		{ column: 'visit_date', label: 'Visited', type: 'date', card: 'date' }
	],

	// Progress toward all 64: a ring, and a grid with a slot for each park. A park counts once, however often it is visited.
	plots: [
		{ slug: 'park_ring', kind: 'progress', name: 'Progress ring', title: 'Parks visited', look: 'ring', count: 'park_name', of: 'parks', size: 'half' },
		{ slug: 'park_grid', kind: 'progress', name: 'Progress grid', title: 'Parks visited', look: 'grid', count: 'park_name', of: 'parks', label: 'code', sublabel: 'label', size: 'full' }
	]
} as const;
