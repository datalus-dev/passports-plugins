# Contributing a passport

A passport is a folder under `passports/<slug>/` with three things: `registry.ts`, `sample.json` and one or more cards in `cards/`. Nothing else goes in it, except a `data/` folder of `.csv` files when the passport has datasets.

## How a passport gets into the app

1. **You open a pull request** adding your folder, on [Tangled](https://tangled.org/passports.social/passports-plugins). The GitHub repository is a read-only mirror and does not take pull requests.
2. **CI checks it** (`npm run validate`). The checks read your files as data and never run them. A pull request that fails them is not reviewed until it passes.
3. **A maintainer reviews it** (the registry, the card and the sample data) and either asks for changes or approves it.
4. **It is merged** into `main` here.
5. **The app pulls it in.** In the app repo, a script copies the approved folder from a pinned commit of this repo, generates the database migration from your `registry.ts`, and puts both in an app pull request, which is reviewed again before it ships. You never write SQL.

A merged plugin is not live until step 5 is done.

## `registry.ts`

One `export default { … }` made only of plain values (strings, numbers, true, false, null, lists and objects). No imports, functions or spreads.

| Key | |
|---|---|
| `slug` | Lowercase letters, digits and underscores; must match the folder name and not be a core passport's. |
| `emoji`, `name`, `description` | Shown on Explore and in the app. |
| `entryName`, `entriesTitle` | The singular and plural words for one entry ("visit", "Visits"). |
| `entrySlugs` | The cards, one per file in `cards/` (`['national_park_stamp']` means `cards/national_park_stamp.svelte`). |
| `folioName` | `null`. |
| `entryTable` | The table's name; starts with `<slug>_`. |
| `hasVisibility` | `true`. |
| `dateFields` | Exactly the columns whose field type is `date`. |
| `fields` | The columns, below. |
| `datasets` | Optional; read-only lists the passport ships for its owners to pick from, below. |
| `authors`, `license` | Who made it and under what terms, below. Required. |
| `repository` | Optional; an `https://` link to where it lives. |
| `plots` | Optional; charts the app draws from your entries, below. |
| `filters` | Optional; columns the entries can be narrowed by, below. |
| `source` | Optional; where the entries come from when the owner doesn't type them in, below. |
| `entryColor` | Optional; `true` lets the owner pick one color for all of their entries in this passport. Each card receives it as a `color` prop, and keeps its own default when there is none. |

Each entry has a note and a visibility already; do not declare them. The app always generates your passport's table from `fields`; a passport can't point at a table that already exists (that is only for the app's own passports).

### `authors` and `license`

Credit for the passport, shown wherever it is credited.

```ts
authors: [{ name: 'Teon L. Brooks', url: 'https://teonbrooks.com', did: 'did:plc:yl7wcldipsfnjdww2jg5mnrv' }],
license: 'MIT',
```

- `authors`: one to ten people. Each has a `name` (required), and optionally an `https://` `url` and a `did` (`did:plc:…` or `did:web:…`, their Atmosphere identity).
- `license`: one of `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC` or `CC0-1.0`. Your passport is copied into the app and published, so the license has to allow that.

### `fields`

Each field is a column in the passport's table, a control in the add and edit forms, and, with `card`, a prop of your card.

```ts
{ column: 'park_name', label: 'Park', type: 'text', required: true, card: 'title' }
```

- `column`: lowercase letters, digits and underscores. Not one of the standard columns (`id`, `user_id`, `visibility`, `note`, `image_paths`, `entry_source`, `created_at`, `updated_at`, `atproto_*`).
- `type`: `text`, `longtext`, `date`, `number`, `select` (needs `options`, a list of strings) or `lookup` (needs `dataset`; see `datasets` below).
- `required`: optional; `true` makes the form require it.
- `card`: optional; the name of the card prop this column feeds.

### `datasets` and `lookup` fields

A dataset is a list the passport ships for its owners to pick from: the 64 National Parks, say. You put it in a `.csv` file in the passport's own `data/` folder and describe it in `datasets`. A `lookup` field then lets the owner search the list and pick one row.

```ts
datasets: [{
  slug: 'parks',
  file: 'data/parks.csv',
  key: 'name',
  columns: [{ column: 'code' }, { column: 'name' }, { column: 'label' }, { column: 'state' }],
  credit: { name: 'nps.gov', url: 'https://www.nps.gov/aboutus/national-park-system.htm', note: 'Public domain' }
}],
fields: [
  { column: 'park_name', label: 'Park', type: 'lookup', required: true, dataset: 'parks', show: 'label', sub: 'state',
    find: ['label', 'name', 'code', 'state'], fill: { park_code: 'code', park_label: 'label' } },
  { column: 'park_code', label: 'Park code', type: 'text', card: 'code' },
  { column: 'park_label', label: 'Park label', type: 'text', card: 'title' }
]
```

A dataset is yours alone: it lives in your folder, its table is named `<slug>_<dataset>` (here `national_parks_parks`), and a lookup can only use a dataset of the same passport. The table is read-only, filled when the app's migration runs, and the app keeps a copy on the device, so the picker works offline.

- `slug`: lowercase letters, digits and underscores. `file`: a `data/<name>.csv` path inside your folder; no other path is accepted.
- `columns`: one to six, all text. `key`: the column whose value is stored on an entry and that identifies a row; it is unique and never empty.
- `credit`: required. `name` and an `https://` `url` say where the data comes from; `note` is optional short text such as "Public domain". It is not a license field.
- The csv's first line is the column names, in the order you list them. Commas, quotes and rows only: a cell can't span lines, hold `<` or `>`, or be longer than 200 characters. At most 1000 rows and 100 KB.
- A `lookup` field stores the picked row's `key`. `show` is the column the picker writes for each row (default: the key), `sub` a second line, and `find` the columns the box searches (default: all).
- `fill` copies columns of the picked row into other `text` fields of the entry, so a card can use them. The form doesn't show a field that is filled this way, and each field is filled by one lookup.

Keep the key as the source spelling (NPS writes `Hawai'i`), and put the spelling you want shown in another column (`label`).

### `plots`

Charts are declared, not written: you say which columns to draw and the app draws them with its own chart kinds, so none of your code runs. Up to six.

```ts
plots: [{ slug: 'park_map', kind: 'map', name: 'Map', lat: 'latitude', lon: 'longitude', label: 'park_name', date: 'visit_date' }]
```

- `slug`: lowercase letters, digits and underscores; unique in the passport.
- `kind`: `map` (a flat world map), `globe` (a globe the owner can spin) or `progress` (how many of a dataset's rows the owner has picked, below). `map` and `globe` pin each entry that has a position.
- `name`: what the "add a chart" list shows. `title`: optional heading; defaults to `name`.
- `lat`, `lon`: required; `number` fields.
- `label`, `sublabel`: optional; `text`, `longtext` or `select` fields shown in the tooltip. `date`: optional; a `date` field.
- `pin`: optional; one emoji (default 📍). `size`: optional; `full` or `half`.

A `progress` chart takes no position. It counts the distinct values the owner has picked in a lookup field, against the rows of that lookup's dataset, so a park visited twice counts once.

```ts
plots: [
  { slug: 'park_ring', kind: 'progress', name: 'Progress ring', title: 'Parks visited', look: 'ring', count: 'park_name', of: 'parks', size: 'half' },
  { slug: 'park_grid', kind: 'progress', name: 'Progress grid', title: 'Parks visited', look: 'grid', count: 'park_name', of: 'parks', label: 'code', sublabel: 'label', size: 'full' }
]
```

- `look`: `ring` (a ring with the count in the middle) or `grid` (a slot for every row, filled when picked). A narrow panel draws a compact form of either, on its own.
- `count`: the `lookup` field to count. `of`: that field's dataset.
- `label`, `sublabel`: optional dataset columns: what a filled slot of the grid writes, and what shows when you point at a slot.

### `filters`

A dropdown to narrow the entries by a column. The app shows it only when the entries actually differ in that column. Up to three.

```ts
filters: [{ column: 'kind', label: 'Kind', options: { park: 'National Park', monument: 'Monument' }, default: 'park' }]
```

- `column`: a `text`, `select` or `number` field.
- `label`: the dropdown's name.
- `options`: optional; value → label. Values you don't list still appear, under their own value.
- `default`: optional; the value an entry counts as having when the column is empty.

### `source`

For a passport whose entries come from somewhere else, not from the owner typing them in. You say what to read and which column each value fills; the app does the fetching, mapping and keeping the table in line, and none of your code runs. Entries from a source can't be added or edited by hand.

```ts
source: {
  kind: 'pds',
  collection: 'app.example.park',
  map: { park_name: 'name', visit_date: 'visitedOn', photo: { path: 'image', type: 'blob' } }
}
```

- `kind`: `pds`, the records of one collection in the owner's own AT Protocol repo.
- `collection`: the collection's NSID.
- `map`: column → where in the record it comes from, a dotted path (`location.latitude`). Every column is one of your `fields`. A value can also be `{ path, default, type }`: `default` fills in when the record has nothing, and `type` is `text`, `number`, `integer`, `blob` or `blobs`.
- `blob` turns an uploaded file (an image, say) into a link, kept as text; `blobs` does it for a list and keeps a JSON list of links, with `of` naming where the file is inside each item (`{ path: 'embed.images', type: 'blobs', of: 'image' }`). The column must be a `text` or `longtext` field.
- `derive`: optional; a column filled by `{ when, equals, then, else }`, for a value a plain mapping can't give.
- `place`: optional; `{ column, from, category }` gives each entry a place from the name in `from`.

## Cards

A card draws one entry from plain props and does nothing else.

- Read props with `$props()`: the ones you named in `card`, plus `color` (the owner's entry color, only when the registry sets `entryColor: true`), `variant` (`'full'` or `'simplified'`), `font` (`'mono'` or `'inherit'`), and the optional snippets `controls` and `strip` (the app draws its select and delete controls and the visibility row there; draw them inside your card's own box, and not at all when `variant` is `'simplified'`).
- Import only from `svelte`. No `fetch`, storage, `document` or `window`, no dynamic `import()`, no `{@html}`, no `<iframe>`, no `<svelte:window>` or `<svelte:head>`.
- Scoped styles only: no `:global` and no `@import`. Prefix your class names (`np-card`, not `card`): DaisyUI styles bare names such as `card`, `badge`, `toggle` and `label` everywhere.
- The card's outer box should be `position: relative`, so the app's controls land on it.
- Props arrive as text ready to show: a `date` field reaches your card as "Sep 14, 2024", not "2024-09-14". A `number` field arrives as a number.
- See your card with your sample data: `npm run preview` (http://localhost:5195), full and simplified.

## `sample.json`

One to twelve example entries, keyed by column (and optionally `note`), used to preview your card. Dates look like `2025-07-15`.

## What is not supported yet

Photos the owner uploads in the form (photos that come from a `source` as `blob` links work), publishing entries as AT Protocol records and the lexicons for them, a `lexicons/` folder, folios, and links from an entry to a place. A passport that needs these is a full-code passport and is reviewed as a whole; open an issue first.
