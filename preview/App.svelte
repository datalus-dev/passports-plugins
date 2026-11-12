<script>
	import plugins from 'virtual:plugins';

	// Every card file of every plugin, keyed by path.
	const cardModules = import.meta.glob('../passports/*/cards/*.svelte', { eager: true });

	let font = $state('mono');

	/** Dates reach a card as ready-to-show text, like the app's formatDate. */
	const show = (field, v) =>
		field.type === 'date' ? new Date(`${v}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : v;

	/** A sample row becomes the card's props through each field's `card` name. */
	const propsFor = (registry, row) => {
		const out = {};
		for (const f of registry.fields) if (f.card && row[f.column] != null) out[f.card] = show(f, row[f.column]);
		return out;
	};

	const cardFor = (folder, slug) => cardModules[`../passports/${folder}/cards/${slug}.svelte`]?.default;
</script>

<main class={font === 'inherit' ? 'host' : ''}>
	<h1>passports-plugins preview</h1>
	<label><input type="checkbox" checked={font === 'inherit'} onchange={(e) => (font = e.currentTarget.checked ? 'inherit' : 'mono')} /> font="inherit" (page font)</label>

	{#each plugins as p}
		<h2>{p.registry.emoji} {p.registry.name} <small>{p.folder}</small></h2>
		{#each p.registry.entrySlugs as slug}
			{@const Card = cardFor(p.folder, slug)}
			<h3>{slug}</h3>
			{#each ['full', 'simplified'] as variant}
				<p class="variant">{variant}</p>
				<div class="row">
					{#each p.sample as row}
						{#if Card}<Card {...propsFor(p.registry, row)} {variant} {font} />{/if}
					{/each}
				</div>
			{/each}
		{/each}
	{/each}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #f1ede4;
		color: #2a2a2a;
		font-family: system-ui, sans-serif;
	}
	main {
		max-width: 62rem;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
	}
	main.host {
		font-family: Georgia, serif;
	}
	small {
		font-weight: 400;
		opacity: 0.6;
		font-size: 0.7em;
	}
	.variant {
		font-size: 0.8rem;
		opacity: 0.7;
		margin: 1rem 0 0.5rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		padding: 0.5rem 0 1rem;
	}
</style>
