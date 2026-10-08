export const getFullWidth = (elem: HTMLElement): number => Math.max(elem.offsetWidth, elem.scrollWidth);

export const getFullHeight = (elem: HTMLElement): number => Math.max(elem.offsetHeight, elem.scrollHeight);

export const textNodeFromPoint = (element: Element, x: number, y: number): Node | false => {
    const nodes = element.childNodes;
    const range = document.createRange();
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as Node;
        if (node.nodeType !== 3) {
            continue;
        }
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom) {
            return node;
        }
    }
    return false;
};

// document.selection is the legacy IE API, there is no IE support anymore but the port keeps behavior as is
interface LegacySelection {
    removeAllRanges?: () => void;
    empty?: () => void;
}

export const clearTextSelection = (): void => {
    const selection: LegacySelection | null = window.getSelection
        ? window.getSelection()
        : (document as unknown as { selection?: LegacySelection }).selection || null;
    if (!selection) {
        return;
    }
    if (selection.removeAllRanges) {
        selection.removeAllRanges();
    } else if (selection.empty) {
        selection.empty();
    }
};
