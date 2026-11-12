<script>
	let { title = '', code = '', date = '', variant = 'full', font = 'mono', controls, strip } = $props();

	const simple = $derived(variant === 'simplified');
	const family = $derived(font === 'inherit' ? 'inherit' : "var(--ps-font, 'DM Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace)");
</script>

<div class="np-wrap" style:font-family={family}>
	<div class="np-card">
		{#if !simple}{@render controls?.()}{/if}

		<div class="np-inner">
			<p class="np-kicker">National Park</p>

			<div class="np-seal" aria-hidden="true">
				<span class="np-code">{code || '🌳'}</span>
			</div>

			<p class="np-name">{title}</p>
			{#if date}<p class="np-date">{date}</p>{/if}
		</div>

		{#if !simple}{@render strip?.()}{/if}
	</div>
</div>

<style>
	.np-wrap {
		color-scheme: light;
		width: 9.5rem;
		justify-self: center;
		filter: drop-shadow(0 0 0.75px oklch(68% 0.01 85)) drop-shadow(0 3px 8px oklch(0% 0 0 / 0.15));
		--np-ink: oklch(42% 0.09 150);
	}

	.np-card {
		position: relative;
		width: 100%;
		background: oklch(97% 0.01 85);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	.np-inner {
		margin: 0.45rem;
		padding: 0.55rem 0.55rem 0.5rem;
		border: 1.5px dashed oklch(from var(--np-ink) l c h / 0.55);
		border-radius: 0.35rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		min-height: 8.5rem;
	}

	.np-kicker {
		margin: 0;
		font-size: 0.46rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--np-ink);
	}

	.np-seal {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.6rem;
		height: 3.6rem;
		border-radius: 50%;
		border: 1.5px solid var(--np-ink);
		box-shadow: inset 0 0 0 3px oklch(97% 0.01 85), inset 0 0 0 4.5px oklch(from var(--np-ink) l c h / 0.6);
		background: oklch(from var(--np-ink) l c h / 0.07);
	}

	.np-code {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--np-ink);
	}

	.np-name {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 700;
		line-height: 1.25;
		text-align: center;
		color: oklch(18% 0.01 85);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.np-date {
		margin: 0;
		margin-top: auto;
		font-size: 0.5rem;
		color: oklch(55% 0.01 85);
		font-variant-numeric: tabular-nums;
	}
</style>
