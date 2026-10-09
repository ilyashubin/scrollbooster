export const getFullWidth = (elem: HTMLElement): number => Math.max(elem.offsetWidth, elem.scrollWidth);

export const getFullHeight = (elem: HTMLElement): number => Math.max(elem.offsetHeight, elem.scrollHeight);

export const textNodeFromPoint = (element: Element, x: number, y: number): Node | null => {
    const range = document.createRange();
    for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom) {
            return node;
        }
    }
    return null;
};

export const clearTextSelection = (): void => {
    window.getSelection()?.removeAllRanges();
};
