/**
 * `smooth` unless the user asked the OS for reduced motion (plan §13.1). The global CSS rule can't
 * reach scrolls started from script, so every `scrollIntoView`/`scrollTo` goes through this.
 */
export function scrollBehavior(document: Document): ScrollBehavior {
  return document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}
