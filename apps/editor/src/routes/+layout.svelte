<script lang="ts">
    import type { Location, Runtime, Warning } from '@lovechild/strudel'
    import { onMount, type Snippet } from 'svelte'
    import { afterNavigate, goto } from '$app/navigation'
    import { page } from '$app/state'
    import Graph from '$lib/docs/Graph.svelte'
    import QuickReference from '$lib/docs/QuickReference.svelte'
    import type { Editor } from '$lib/editor/editor'
    import { isShortcutModifier } from '$lib/editor/keys'
    import type { LineMessage } from '$lib/editor/lines'
    import type { Output } from '$lib/editor/output'
    import FrameRate from '$lib/editor/FrameRate.svelte'
    import { countFrame } from '$lib/editor/frames.svelte'
    import Settings from '$lib/editor/Settings.svelte'
    import { loadSettings, resolutionScales, settings } from '$lib/editor/preferences.svelte'
    import { readSavedCode, saveCode } from '$lib/editor/storage'
    import type { Viewer } from '$lib/editor/viewer'
    import { addRunHint, examples, pickExampleName, pickIndexExampleName } from '$lib/examples/examples'
    import { describeError, describeWarning, type Notice } from '$lib/messages'
    import { setExamplePlayer, type Example, type ExamplePlayer } from '$lib/player'
    import CodeToolbar from '$lib/toolbar/CodeToolbar.svelte'
    import ExploreToolbar from '$lib/toolbar/ExploreToolbar.svelte'
    import Toolbar from '$lib/toolbar/Toolbar.svelte'
    import '../app.css'

    let { children }: { children: Snippet } = $props()

    const codePath = '/code'
    const explorePath = '/explore'
    const homePath = '/'
    const defaultInfoPath = '/start-here'
    const editorId = Symbol('editor')
    const graphRoutes = ['/explore', '/[page]', '/strudel/[page]']
    const isCodePage = $derived(page.route.id === codePath)
    const isGraphPage = $derived(graphRoutes.includes(page.route.id ?? ''))
    const isExplorePage = $derived(page.route.id === explorePath)
    const isHomePage = $derived(page.url.pathname === homePath)
    const paneless = [codePath, explorePath, homePath]

    let canvas: HTMLCanvasElement
    let container: HTMLElement
    let viewerContainer: HTMLElement
    let runtime: Runtime | undefined
    let editor: Editor | undefined = $state.raw()
    let viewer: Viewer | undefined = $state.raw()
    let locateError: ((error: unknown) => ReadonlyArray<Location>) | undefined
    let isMuted = $state(true)
    let hasBlockedSound = $state(false)
    let hasMutedManually = false
    let shouldUnmute = false
    let isPanelOpen = $state(true)
    let output: Output = $state.raw({ transpiled: '', graph: undefined })
    let notices: Array<Notice> = $state([])
    let warnings: Array<Warning> = []
    let errors: Array<LineMessage> = []
    let playing: Example | undefined = $state.raw()
    let last: Example | undefined
    let lastPanePath = $state(defaultInfoPath)
    let search = $state('')
    let searchFocus: string | undefined = $state()
    let currentExampleName: string | undefined
    let playId = 0

    afterNavigate(({ from }) => {
        if (from && !paneless.includes(from.route.id ?? '') && from.url.pathname !== homePath) {
            lastPanePath = from.url.pathname
        }
    })

    const addNotice = (notice: Notice) => {
        notices = [...notices, notice]
    }

    const showWarning = (warning: Warning) => {
        console.warn(warning)

        if (warning.locations.length > 0 && playing?.showWarning) {
            playing.showWarning(warning)
            return
        }

        addNotice({ kind: 'warning', text: describeWarning(warning) })
    }

    const showError = (error: unknown, locations: ReadonlyArray<Location>) => {
        console.error(error)

        if (locations.length > 0 && playing?.showError) {
            playing.showError(error, locations)
            return
        }

        addNotice({ kind: 'error', text: describeError(error) })
    }

    const unmute = async () => {
        hasMutedManually = false

        if (!isMuted) {
            return
        }

        if (!runtime) {
            shouldUnmute = true
            return
        }

        shouldUnmute = false
        await runtime.unmute()

        if (!hasMutedManually) {
            isMuted = false
            hasBlockedSound = false
        }
    }

    const mute = () => {
        hasMutedManually = true
        shouldUnmute = false
        isMuted = true
        runtime?.mute()
    }

    const toggleMute = () => {
        if (isMuted) {
            unmute()
            return
        }

        mute()
    }

    const mutedNotice: Notice = { kind: 'info', text: 'sound muted — click to unmute', onSelect: unmute }
    const shownNotices = $derived(isMuted && hasBlockedSound ? [mutedNotice, ...notices] : notices)

    const showEditorWarning = (warning: Warning) => {
        warnings = [...warnings, warning]
        editor?.showWarnings(warnings.flatMap((shown) => shown.locations.map((location) => ({ location, text: describeWarning(shown) }))))
    }

    const showEditorError = (error: unknown, locations: ReadonlyArray<Location>) => {
        errors = [...errors, ...locations.map((location) => ({ location, text: describeError(error) }))]
        editor?.showErrors(errors)
    }

    const player: ExamplePlayer = {
        get playing() {
            return playing?.id
        },
        get code() {
            return last?.code
        },
        play: async (example) => {
            const currentPlayId = ++playId

            if (!example.isAutomatic && !hasMutedManually) {
                await unmute()

                if (currentPlayId !== playId) {
                    return undefined
                }
            }

            playing?.onFrame(0, [])
            playing = example
            last = example
            notices = []
            hasBlockedSound = false

            try {
                const result = await runtime?.evaluate(example.code)
                return currentPlayId === playId ? result : undefined
            } catch (error) {
                if (currentPlayId === playId) {
                    showError(error, locateError?.(error) ?? [])
                }

                return undefined
            }
        },
        stop: () => {
            playId += 1
            hasBlockedSound = false
            runtime?.stop()
            playing = undefined
        },
        openInEditor: (code) => {
            const hinted = addRunHint(code)
            editor?.setCode(hinted, true)
            saveCode(hinted)
            goto(codePath)
            playEditor(hinted)
        },
    }

    setExamplePlayer(player)

    const playEditor = async (code: string, isAutomatic = false) => {
        warnings = []
        errors = []
        editor?.showWarnings([])
        editor?.showErrors([])

        const result = await player.play({
            id: editorId,
            code,
            isAutomatic,
            onFrame: (time, haps) => editor?.highlight(time, haps),
            showWarning: showEditorWarning,
            showError: showEditorError,
        })

        if (result) {
            editor?.showEvaluation(result)
            output = { transpiled: result.transpiled, graph: result.graph }
        }
    }

    const evaluateEditor = (code: string) => {
        saveCode(code)
        playEditor(code)
    }

    const shuffle = () => {
        const excluded = page.params.example ?? currentExampleName
        const name = pickExampleName(excluded)
        const code = examples.get(name)

        if (code === undefined) {
            return
        }

        currentExampleName = name

        if (isCodePage) {
            const hinted = addRunHint(code)
            editor?.setCode(hinted, true)
            playEditor(hinted)
            return
        }

        goto(`/examples/${name}`, { state: { isChosen: true } })
    }

    const isEditing = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) {
            return false
        }

        const isFilledField = (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && target.value !== ''
        return isFilledField || target.closest('.cm-editor') !== null
    }

    const replay = () => {
        if (last) {
            player.play({ ...last, isAutomatic: false })
        }
    }

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.defaultPrevented) {
            return
        }

        if (isShortcutModifier(event)) {
            if (event.code === 'Period') {
                event.preventDefault()
                player.stop()
                return
            }

            if (event.code === 'Enter' && !isEditing(event.target)) {
                event.preventDefault()

                if (isCodePage) {
                    editor?.evaluate()
                } else {
                    replay()
                }

                return
            }
        }

        if (event.key !== 'Escape' || isCodePage || isEditing(event.target)) {
            return
        }

        goto(isExplorePage ? codePath : explorePath)
    }

    onMount(() => {
        let isMounted = true
        loadSettings()
        isPanelOpen = window.innerWidth > 800

        Promise.all([
            import('@lovechild/strudel'),
            import('$lib/editor/editor'),
            import('$lib/editor/viewer'),
            import('@strudel/codemirror/slider.mjs'),
        ]).then(([strudel, { createEditor }, { createViewer }, { slider, sliderWithID }]) => {
            if (!isMounted) {
                return
            }

            locateError = strudel.locateError

            runtime = strudel.createRuntime(canvas, {
                onFrame: (time, haps) => {
                    countFrame(performance.now())
                    playing?.onFrame(time, haps)
                },
                onWarning: showWarning,
                onPlaybackError: showError,
                onBlockedSound: () => {
                    hasBlockedSound = true
                },
                scope: { slider, sliderWithID },
            })

            runtime.setResolution(resolutionScales[settings.resolution])

            if (shouldUnmute) {
                unmute()
            }

            editor = createEditor({ parent: container, onEvaluate: evaluateEditor, onStop: player.stop, shouldFormat: () => settings.format === 'on' })
            viewer = createViewer({ parent: viewerContainer, onEvaluate: () => editor?.evaluate(), onStop: player.stop })

            const savedCode = readSavedCode()
            const initialName = savedCode === undefined ? pickIndexExampleName() : undefined
            const initialExampleCode = initialName ? examples.get(initialName) ?? '' : ''
            const editorCode = savedCode ?? addRunHint(initialExampleCode)
            currentExampleName = initialName
            editor.setCode(editorCode)

            if (isCodePage) {
                playEditor(editorCode, true)
                return
            }

            const backgroundCode = initialExampleCode || examples.get(pickIndexExampleName()) || editorCode
            player.play(last ?? { id: Symbol('background'), code: backgroundCode, isAutomatic: true, onFrame: () => {} })
        })

        return () => {
            isMounted = false
            viewer?.destroy()
            editor?.destroy()
            runtime?.destroy()
        }
    })

    $effect(() => {
        runtime?.setResolution(resolutionScales[settings.resolution])
    })

    $effect(() => {
        if (settings.display === 'code') {
            return
        }

        const shown = settings.display
        const currentOutput = output
        const currentViewer = viewer

        if (!currentViewer) {
            return
        }

        let isCurrent = true

        import('$lib/editor/output').then(({ formatOutput }) => formatOutput(shown, currentOutput)).then((code) => {
            if (isCurrent) {
                currentViewer.show(code)
            }
        })

        return () => {
            isCurrent = false
        }
    })
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
    <title>
        lovestory
    </title>
</svelte:head>

{#snippet panel()}
    <QuickReference />
    <Settings />
{/snippet}

<canvas class="stage" bind:this={canvas}></canvas>
<main hidden={!isCodePage} class:narrow={isCodePage && isPanelOpen}>
    <div bind:this={container} hidden={settings.display !== 'code'}></div>
    <div bind:this={viewerContainer} hidden={settings.display === 'code'}></div>
    {#if settings.fps === 'on' && playing}
        <FrameRate />
    {/if}
</main>
<Graph current={page.url.pathname} isVisible={isGraphPage} isInteractive={isExplorePage} search={isExplorePage ? search : ''} focus={isExplorePage ? searchFocus : undefined} />
{@render children()}
{#if isCodePage}
    <CodeToolbar
        infoHref={lastPanePath}
        {isMuted}
        notices={shownNotices}
        onPlay={() => editor?.evaluate()}
        onStop={player.stop}
        onToggleMute={toggleMute}
        onShuffle={shuffle}
        {panel}
        bind:isPanelOpen
    />
{:else if isExplorePage}
    <ExploreToolbar
        infoHref={lastPanePath}
        {isMuted}
        notices={shownNotices}
        onPlay={replay}
        onStop={player.stop}
        onToggleMute={toggleMute}
        onShuffle={shuffle}
        bind:search
        bind:focus={searchFocus}
    />
{:else}
    <Toolbar
        isHomeSelected={isHomePage}
        isGraphSelected={isGraphPage}
        isInfoSelected={!isHomePage}
        {isMuted}
        infoHref={lastPanePath}
        notices={shownNotices}
        onPlay={replay}
        onStop={player.stop}
        onToggleMute={toggleMute}
        onShuffle={shuffle}
    />
{/if}

<style>
    main {
        position: fixed;
        inset: 0;
        contain: strict;
    }

    main.narrow {
        right: var(--panel-width);
    }

    main > div {
        height: 100%;
    }

    @media (max-width: 800px) {
        main.narrow {
            right: 0;
        }
    }
</style>
