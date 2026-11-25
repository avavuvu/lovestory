export const isShortcutModifier = (event: KeyboardEvent) => !event.shiftKey && (event.altKey || event.ctrlKey || event.metaKey)

export const createKeyHandler = (onEvaluate: () => void, onStop: () => void) => (event: KeyboardEvent) => {
    if (!isShortcutModifier(event)) {
        return false
    }

    if (event.code === 'Enter') {
        event.preventDefault()
        onEvaluate()
        return true
    }

    if (event.code === 'Period') {
        event.preventDefault()
        onStop()
        return true
    }

    return false
}
