<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Notice } from '../messages'
    import Toolbar from './Toolbar.svelte'

    let {
        infoHref,
        isMuted = false,
        notices = [],
        onPlay,
        onStop,
        onToggleMute,
        onShuffle,
        panel,
        isPanelOpen = $bindable(false),
    }: {
        infoHref: string
        isMuted?: boolean
        notices?: ReadonlyArray<Notice>
        onPlay: () => void
        onStop: () => void
        onToggleMute: () => void
        onShuffle: () => void
        panel: Snippet
        isPanelOpen?: boolean
    } = $props()
</script>

{#snippet start()}
    <div class="leading">
        <button
            type="button"
            class="toggle"
            aria-expanded={isPanelOpen}
            aria-controls="code-panel"
            aria-label={isPanelOpen ? 'hide reference panel' : 'show reference panel'}
            title={isPanelOpen ? 'hide reference panel' : 'show reference panel'}
            onclick={() => isPanelOpen = !isPanelOpen}
        >
            {isPanelOpen ? '▾' : '▸'}
        </button>
        <a href="/" class="brand" title="home">lovestory</a>
    </div>
{/snippet}

<Toolbar {infoHref} {isMuted} {notices} {onPlay} {onStop} {onToggleMute} {onShuffle} {start}>
    <section id="code-panel" class:open={isPanelOpen} inert={!isPanelOpen}>
        {@render panel()}
    </section>
</Toolbar>

<style>
    .leading {
        display: flex;
        flex: 1;
        min-width: 0;
    }

    .toggle {
        display: grid;
        place-items: center;
        min-width: 28px;
        height: 100%;
        background: var(--color-background);
        color: var(--color-foreground);
        cursor: pointer;
    }

    .brand {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        padding: 0 var(--gap) 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-decoration: none;
        background: var(--color-background);
        color: var(--color-foreground);
    }

    .toggle:hover,
    .brand:hover {
        background: var(--color-selection);
    }

    .toggle:focus-visible,
    .brand:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
    }

    section {
        display: flex;
        flex-direction: column;
        height: 0;
        overflow: hidden;
        transition: height 300ms ease;
    }

    section.open {
        height: calc(100dvh - 2px - var(--notices-height) - var(--row-height));
    }

    @media (prefers-reduced-motion: reduce) {
        section {
            transition: none;
        }
    }
</style>
