// Vite imports a file as text with the `?raw` suffix: the landing shows the source of its examples
declare module '*?raw' {
    const source: string;
    export default source;
}
