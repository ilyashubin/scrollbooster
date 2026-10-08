// Entry with a single default export: CommonJS build gets `module.exports = ScrollBooster`
// and the IIFE build gets `window.ScrollBooster`, both compatible with 3.x
import { ScrollBooster } from './scroll-booster';

export default ScrollBooster;
