/* Motion helpers. Everything here is skipped when the person has asked their
 * device for reduced motion. Timings follow the tokens in theme/tokens.css. */

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';

/** A short "landed here" pulse on an element (placement and undo feedback). */
export function pulse(el) {
  if (!el || reducedMotion() || !el.animate) return;
  el.animate(
    [
      { transform: 'scale(1.14)', boxShadow: '0 0 0 3px var(--focus)' },
      { transform: 'scale(1)', boxShadow: '0 0 0 0 transparent' },
    ],
    { duration: 420, easing: EASE_OUT },
  );
}

/** Move a floating element to a target's centre, then remove it. */
export function flyTo(el, target, { fade = false } = {}) {
  if (!el) return;
  const done = () => el.remove();
  if (!target || reducedMotion() || !el.animate) return done();
  const a = el.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = el.animate(
    [{ transform: getComputedStyle(el).transform, opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.9)`, opacity: fade ? 0 : .6 }],
    { duration: 180, easing: EASE_OUT, fill: 'forwards' },
  );
  anim.onfinish = done;
  anim.oncancel = done;
}
