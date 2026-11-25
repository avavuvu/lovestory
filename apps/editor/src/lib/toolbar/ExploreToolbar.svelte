<script lang="ts">
    import { onMount } from 'svelte'
    import { goto } from '$app/navigation'
    import type { GraphNode } from '$lib/server/graph'
    import { findSearchMatch, loadGraph, type SearchMatch } from '../docs/graph-data'
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
        search = $bindable(''),
        focus = $bindable(),
    }: {
        infoHref: string
        isMuted?: boolean
        notices?: ReadonlyArray<Notice>
        onPlay: () => void
        onStop: () => void
        onToggleMute: () => void
        onShuffle: () => void
        search?: string
        focus?: string
    } = $props()

    let nodes: ReadonlyArray<GraphNode> = $state.raw([])
    let activeIndex = $state(0)
    let list: HTMLUListElement | undefined = $state.raw()

    const results: ReadonlyArray<SearchMatch> = $derived(search.trim() === ''
        ? []
        : nodes
            .flatMap((node) => findSearchMatch(node, search) ?? [])
            .sort((a, b) => a.node.label.localeCompare(b.node.label)))

    const moveActive = (step: number) => {
        activeIndex = Math.min(Math.max(activeIndex + step, 0), results.length - 1)
    }

    const handleKey = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            moveActive(event.key === 'ArrowDown' ? 1 : -1)
            return
        }

        if (event.key === 'Enter' && results[activeIndex]) {
            goto(results[activeIndex].node.href)
        }
    }

    $effect(() => {
        focus = results[activeIndex]?.node.href
        list?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
    })

    onMount(() => {
        loadGraph().then((graph) => {
            nodes = graph.nodes
        })
    })
</script>

{#snippet field()}
    <div class="leading">
        <a href="/" class="home" aria-label="home" title="home">🏠</a>
        <input type="search" placeholder="search" aria-label="search documentation" bind:value={search} oninput={() => activeIndex = 0} onkeydown={handleKey} />
    </div>
{/snippet}

<Toolbar isGraphSelected {infoHref} {isMuted} {notices} {onPlay} {onStop} {onToggleMute} {onShuffle} start={field}>
    {#if results.length > 0}
        <ul bind:this={list}>
            {#each results as { node, alias }, index (node.key)}
                <li>
                    <a class={node.kind} class:active={index === activeIndex} href={node.href} onmouseenter={() => activeIndex = index}>
                        {node.label}
                        {#if alias}
                            <span class="alias">{alias}</span>
                        {/if}
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</Toolbar>

<style>
    .leading {
        display: flex;
        flex: 1;
        min-width: 0;
    }

    .home {
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
    }

    .home:hover {
        background: var(--color-selection);
    }

    .home:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
    }

    input {
        flex: 1;
        min-width: 0;
        padding: 0 var(--gap);
        background: var(--color-background);
        color: var(--color-foreground);
    }

    input:focus {
        outline: none;
        box-shadow: inset 0 0 0 1px var(--color-primary);
    }

    ul {
        max-height: 50dvh;
        overflow-y: auto;
        border-top: var(--border);
    }

    ul a {
        display: block;
        padding: 0 var(--gap);
        line-height: var(--row-height);
        color: var(--kind-color);
        text-decoration: none;
    }

    .alias {
        color: var(--color-muted);
    }

    ul a.active,
    ul a:focus-visible {
        background: var(--color-foreground);
        color: var(--color-background);
        outline: none;
    }

    ul a.active .alias,
    ul a:focus-visible .alias {
        color: var(--color-background);
        opacity: 0.75;
    }
</style>
