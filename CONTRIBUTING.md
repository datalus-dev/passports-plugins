# Contributing a passport

A passport is a folder under `passports/<slug>/` with three things: `registry.ts`, `sample.json` and one or more cards in `cards/`. Nothing else goes in it.

## How a passport gets into the app

1. **You open a pull request** adding your folder.
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

Each entry has a note and a visibility already; do not declare them.

### `fields`

Each field is a column in the passport's table, a control in the add and edit forms, and, with `card`, a prop of your card.

```ts
{ column: 'park_name', label: 'Park', type: 'text', required: true, card: 'title' }
```

- `column`: lowercase letters, digits and underscores. Not one of the standard columns (`id`, `user_id`, `visibility`, `note`, `image_paths`, `entry_source`, `created_at`, `updated_at`, `atproto_*`).
- `type`: `text`, `longtext`, `date`, `number` or `select` (a `select` also needs `options`, a list of strings).
- `required`: optional; `true` makes the form require it.
- `card`: optional; the name of the card prop this column feeds.

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

Photos, AT Protocol records and lexicons, plots and maps, folios, and links from an entry to a place. A passport that needs these is a full-code passport and is reviewed as a whole; open an issue first.
