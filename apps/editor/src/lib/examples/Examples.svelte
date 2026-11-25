<script lang="ts">
    import { goto } from '$app/navigation'
    import { exampleNames } from './examples'

    let { current, onOpen }: { current: string, onOpen?: () => void } = $props()

    const open = (name: string) => goto(`/examples/${name}`, { state: { isChosen: true } })

    const step = (offset: number) => {
        const index = exampleNames.indexOf(current)
        open(exampleNames.at((index + offset) % exampleNames.length) ?? current)
    }
</script>

<nav aria-label="examples">
    <button type="button" onclick={() => step(-1)} aria-label="previous example" title="previous example">←</button>
    <select value={current} aria-label="choose example" onchange={(event) => open(event.currentTarget.value)}>
        {#each exampleNames as name (name)}
            <option value={name}>{name}</option>
        {/each}
    </select>
    <button type="button" onclick={() => step(1)} aria-label="next example" title="next example">→</button>
    {#if onOpen}
        <button type="button" class="open" onclick={onOpen} title="open this example in the editor">open in editor</button>
    {/if}
</nav>

<style>
    nav {
        display: flex;
        height: var(--row-height);
        background: var(--color-background);
        border: var(--border);
    }

    button,
    select {
        height: 100%;
        background: var(--color-background);
        color: var(--color-foreground);
        cursor: pointer;
    }

    button {
        min-width: 32px;
    }

    .open {
        padding: 0 var(--gap);
        border-left: var(--border);
        white-space: nowrap;
    }
</style>
