<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Notice } from '../messages'
    import Notices from './Notices.svelte'

    let {
        isHomeSelected = false,
        isGraphSelected = false,
        isInfoSelected = false,
        isMuted = false,
        infoHref,
        notices = [],
        onPlay,
        onStop,
        onToggleMute,
        onShuffle,
        start,
        children,
    }: {
        isHomeSelected?: boolean
        isGraphSelected?: boolean
        isInfoSelected?: boolean
        isMuted?: boolean
        infoHref: string
        notices?: ReadonlyArray<Notice>
        onPlay: () => void
        onStop: () => void
        onToggleMute: () => void
        onShuffle: () => void
        start?: Snippet
        children?: Snippet
    } = $props()

    const graphHref = $derived(isGraphSelected && !isInfoSelected ? '/code' : '/explore')

    let noticesHeight = $state(0)
</script>

<aside style:--notices-height="{noticesHeight}px">
    <Notices {notices} bind:height={noticesHeight} />
    <div class="bar" class:below={notices.length > 0}>
        <div class="row">
            {#if start}
                {@render start()}
            {:else}
                <a href="/" class="brand" aria-current={isHomeSelected ? 'page' : undefined} title="home">lovestory</a>
            {/if}
            <nav aria-label="main controls">
                <button type="button" onclick={onPlay} aria-label="play" title="play (alt+enter / cmd+enter)">▶&#xFE0F;</button>
                <button type="button" onclick={onStop} aria-label="stop" title="stop (alt+. / cmd+.)">⏹&#xFE0F;</button>
                <button
                    type="button"
                    class:muted={isMuted}
                    onclick={onToggleMute}
                    aria-label={isMuted ? 'unmute sound' : 'mute sound'}
                    aria-pressed={isMuted}
                    title={isMuted ? 'unmute sound' : 'mute sound'}
                >
                    {isMuted ? '🔇' : '🔊'}
                </button>
                <button type="button" onclick={onShuffle} aria-label="random example" title="random example">🔀</button>
                <a href={isInfoSelected ? '/code' : infoHref} class:selected={isInfoSelected} aria-label="docs" title="docs">ℹ&#xFE0F;</a>
                <a href={graphHref} class:selected={isGraphSelected} aria-label="explore graph" title="explore graph">♾&#xFE0F;</a>
            </nav>
        </div>
        {@render children?.()}
    </div>
</aside>

<style>
    aside {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 10;
        display: flex;
        flex-direction: column;
        width: min(var(--panel-width), 100vw);
    }

    aside > :global(*) {
        width: 100%;
        background: var(--color-background);
        color: var(--color-foreground);
    }

    .bar {
        border: var(--border);
    }

    .bar.below {
        border-top: none;
    }

    .row {
        display: flex;
        height: var(--row-height);
    }

    .brand {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        padding: 0 var(--gap);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-decoration: none;
        background: var(--color-background);
        color: var(--color-foreground);
    }

    .brand:hover {
        background: var(--color-selection);
    }

    .brand:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
    }

    nav {
        display: flex;
        margin-left: auto;
    }

    nav button,
    nav a {
        display: grid;
        place-items: center;
        min-width: 32px;
        height: 100%;
        font-family: var(--font-emoji), var(--font-body);
        font-size: 1rem;
        line-height: 1;
        font-variant-emoji: emoji;
        background: var(--color-background);
        color: var(--color-foreground);
        text-decoration: none;
        cursor: pointer;
    }

    nav button.muted {
        color: var(--color-muted);
        opacity: 0.65;
    }

    nav button:hover,
    nav a:hover {
        background: var(--color-selection);
    }

    nav a.selected,
    nav a.selected:hover {
        background: var(--color-primary);
        color: var(--color-on-accent);
    }

    nav button:focus-visible,
    nav a:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
    }
</style>
