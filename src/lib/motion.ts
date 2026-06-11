// GSAP lifecycle helper for Astro View Transitions (PRD §8 A11 note):
// every page script registers via pageScript(); previous setup is reverted
// before each swap so ScrollTriggers never leak across navigations.
export function pageScript(setup: () => (() => void) | void) {
  let cleanup: (() => void) | void;

  const run = () => {
    if (cleanup) cleanup();
    cleanup = setup();
  };

  document.addEventListener('astro:page-load', run);
  document.addEventListener('astro:before-swap', () => {
    if (cleanup) cleanup();
    cleanup = undefined;
  });
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
