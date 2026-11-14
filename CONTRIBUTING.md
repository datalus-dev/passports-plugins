# Contributing a passport

A passport is a folder under `passports/<slug>/` with three things: `registry.ts`, `sample.json` and one or more cards in `cards/`. Nothing else goes in it.

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
| `authors`, `license` | Who made it and under what terms, below. Required. |
| `repository` | Optional; an `https://` link to where it lives. |
| `plots` | Optional; charts the app draws from your entries, below. |
| `filters` | Optional; columns the entries can be narrowed by, below. |
| `source` | Optional; where the entries come from when the owner doesn't type them in, below. |

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
- `type`: `text`, `longtext`, `date`, `number` or `select` (a `select` also needs `options`, a list of strings).
- `required`: optional; `true` makes the form require it.
- `card`: optional; the name of the card prop this column feeds.

### `plots`

Charts are declared, not written: you say which columns to draw and the app draws them with its own chart kinds, so none of your code runs. Up to six.

```ts
plots: [{ slug: 'park_map', kind: 'map', name: 'Map', lat: 'latitude', lon: 'longitude', label: 'park_name', date: 'visit_date' }]
```

- `slug`: lowercase letters, digits and underscores; unique in the passport.
- `kind`: `map` (a flat world map) or `globe` (a globe the owner can spin). Both pin each entry that has a position.
- `name`: what the "add a chart" list shows. `title`: optional heading; defaults to `name`.
- `lat`, `lon`: required; `number` fields.
- `label`, `sublabel`: optional; `text`, `longtext` or `select` fields shown in the tooltip. `date`: optional; a `date` field.
- `pin`: optional; one emoji (default 📍). `size`: optional; `full` or `half`.

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

- Read props with `$props()`: the ones you named in `card`, plus `variant` (`'full'` or `'simplified'`), `font` (`'mono'` or `'inherit'`), and the optional snippets `controls` and `strip` (the app draws its select and delete controls and the visibility row there; draw them inside your card's own box, and not at all when `variant` is `'simplified'`).
- Import only from `svelte`. No `fetch`, storage, `document` or `window`, no dynamic `import()`, no `{@html}`, no `<iframe>`, no `<svelte:window>` or `<svelte:head>`.
- Scoped styles only: no `:global` and no `@import`. Prefix your class names (`np-card`, not `card`): DaisyUI styles bare names such as `card`, `badge`, `toggle` and `label` everywhere.
- The card's outer box should be `position: relative`, so the app's controls land on it.
- Props arrive as text ready to show: a `date` field reaches your card as "Sep 14, 2024", not "2024-09-14". A `number` field arrives as a number.
- See your card with your sample data: `npm run preview` (http://localhost:5195), full and simplified.

## `sample.json`

One to twelve example entries, keyed by column (and optionally `note`), used to preview your card. Dates look like `2025-07-15`.

## What is not supported yet

Photos the owner uploads in the form (photos that come from a `source` as `blob` links work), publishing entries as AT Protocol records and the lexicons for them, a `lexicons/` folder, folios, and links from an entry to a place. A passport that needs these is a full-code passport and is reviewed as a whole; open an issue first.
