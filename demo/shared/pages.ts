// Demo pages in navigation order, also the build input of `vite.config.ts`
export const PAGES = [
    { file: 'index.html', title: 'Sandbox' },
    { file: 'gallery.html', title: 'Gallery' },
    { file: 'native.html', title: 'Native scroll' },
    { file: 'nested.html', title: 'Nested' },
    { file: 'focus.html', title: 'Focus and keys' },
    { file: 'images.html', title: 'Images' },
    { file: 'spa.html', title: 'Mount and destroy' },
    { file: 'motion.html', title: 'Motion' },
] as const;
