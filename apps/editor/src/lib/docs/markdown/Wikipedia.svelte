<script lang="ts">
    import Hatnote from './Hatnote.svelte'

    let { page }: { page: string } = $props()

    const href = $derived(`https://en.wikipedia.org/wiki/${encodeURIComponent(page.replaceAll(' ', '_'))}`)
</script>

<Hatnote>
    Wikipedia has a page on <a {href} target="_blank" rel="noreferrer">{page}</a>.
</Hatnote>
