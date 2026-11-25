<script>
	let { title = '', code = '', date = '', color = '', variant = 'full', font = 'mono', controls, strip } = $props();

	const simple = $derived(variant === 'simplified');
	const family = $derived(font === 'inherit' ? 'inherit' : "var(--ps-font, 'DM Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace)");

	// Two circles share one id space on a page, so each card names its own arcs.
	const uid = $props.id();

	const name = $derived(title.trim().toUpperCase());
	const when = $derived(date.trim().toUpperCase());
	const mid = $derived(code.trim().toUpperCase() || '\u2605');

	// The name runs along the top of the ring (about 144 units of arc), so a long name gets smaller type, and a very
	// long one is squeezed to fit instead of running off the ring.
	const CHAR = 0.64;
	const ARC = 144;
	const size = $derived(Math.max(6.5, Math.min(12, ARC / (CHAR * Math.max(name.length, 1)))));
	const squeeze = $derived(name.length * CHAR * size > ARC);

	// Each stamp lands a little crooked, the same way every time for the same park.
	const tilt = $derived.by(() => {
		let h = 0;
		for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) | 0;
		return ((Math.abs(h) % 90) - 45) / 10;
	});
	// `color` is the entry color the host passes when there is one (a value from the app's palette). Empty keeps this card's own ink.
</script>

<div class="np-wrap" style:font-family={family} style:--np-ink={color || null}>
	<div class="np-card">
		{#if !simple}{@render controls?.()}{/if}

		<svg class="np-stamp" viewBox="0 0 160 160" role="img" aria-label="{title}{date ? `, ${date}` : ''}" style:transform="rotate({tilt}deg)">
			<defs>
				<path id="{uid}-top" d="M 28,80 a 52,52 0 0 1 104,0" />
				<path id="{uid}-bottom" d="M 22,80 a 58,58 0 0 0 116,0" />
				<!-- Worn ink: the noise cuts small gaps out of the strokes, so it reads as rubber on paper. -->
				<filter id="{uid}-worn" x="0" y="0" width="100%" height="100%">
					<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
					<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="holes" />
					<feComposite in="SourceGraphic" in2="holes" operator="in" />
				</filter>
			</defs>

			<g class="np-ink" filter="url(#{uid}-worn)">
				<circle cx="80" cy="80" r="75" class="np-ring-outer" />
				<circle cx="80" cy="80" r="69" class="np-ring-inner" />

				<text class="np-arc np-arc-name" font-size={size}>
					<textPath href="#{uid}-top" startOffset="50%" text-anchor="middle" textLength={squeeze ? ARC : undefined} lengthAdjust="spacingAndGlyphs">{name}</textPath>
				</text>

				<text class="np-mid" x="80" y="76" text-anchor="middle">{mid}</text>

				<line x1="12" y1="86" x2="148" y2="86" class="np-rule" />
				<line x1="12" y1="108" x2="148" y2="108" class="np-rule" />
				{#if when}<text class="np-when" x="80" y="102" text-anchor="middle">{when}</text>{/if}

				<text class="np-arc np-arc-base" font-size="9">
					<textPath href="#{uid}-bottom" startOffset="50%" text-anchor="middle">NATIONAL PARK</textPath>
				</text>
			</g>
		</svg>

		{#if !simple}{@render strip?.()}{/if}
	</div>
</div>

<style>
	.np-wrap {
		color-scheme: light;
		width: 9.5rem;
		justify-self: center;
		filter: drop-shadow(0 0 0.75px oklch(68% 0.01 85)) drop-shadow(0 3px 8px oklch(0% 0 0 / 0.15));
		--np-ink: oklch(38% 0.15 275);
	}

	.np-card {
		position: relative;
		width: 100%;
		background: oklch(97% 0.012 85);
		border-radius: 0.5rem;
		overflow: hidden;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.np-stamp {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.np-ink {
		color: var(--np-ink);
		opacity: 0.92;
	}

	.np-ring-outer {
		fill: none;
		stroke: currentColor;
		stroke-width: 3;
	}

	.np-ring-inner {
		fill: none;
		stroke: currentColor;
		stroke-width: 1;
	}

	.np-arc {
		fill: currentColor;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.np-arc-base {
		letter-spacing: 0.16em;
	}

	.np-mid {
		fill: currentColor;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.np-rule {
		stroke: currentColor;
		stroke-width: 1.2;
	}

	.np-when {
		fill: currentColor;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.05em;
		font-variant-numeric: tabular-nums;
	}
</style>
