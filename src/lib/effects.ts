// Shared scroll effects: A5 reveals + A6 metric count-ups.
// Call inside a gsap.context() within pageScript().
import { gsap } from 'gsap';

export function setupReveals() {
  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    gsap.from(el, {
      y: 24,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}

// Animates the numeric part of values like "~50%", "150", "99%+", "50k+", "80–90%".
export function setupCountUps() {
  document.querySelectorAll<HTMLElement>('.metric-value').forEach((el) => {
    const raw = el.dataset.value ?? el.textContent ?? '';
    const m = raw.match(/(\d+(?:\.\d+)?)/);
    if (!m) return;
    const target = parseFloat(m[1]);
    const obj = { n: 0 };
    gsap.to(obj, {
      n: target,
      duration: 1.2,
      ease: 'power2.out',
      snap: { n: 1 },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onUpdate() {
        el.textContent = raw.replace(m[1], String(Math.round(obj.n)));
      },
      onComplete() {
        el.textContent = raw;
      },
    });
  });
}
