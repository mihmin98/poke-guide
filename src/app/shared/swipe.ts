import { DOCUMENT, DestroyRef, ElementRef, inject } from '@angular/core';

export type SwipeDirection = 'left' | 'right';

export interface TouchPoint {
  x: number;
  y: number;
  /** Event time stamp, ms. */
  t: number;
}

/** Shortest horizontal travel that counts, in CSS px. */
const MIN_DISTANCE = 64;
/** A slower drag reads as reading or scrolling, not a swipe. */
const MAX_DURATION_MS = 600;
/** Touches starting this close to a screen edge belong to the browser's back/forward gesture. */
const EDGE = 24;

/** Which way a finished touch went, if it was a quick, mostly horizontal swipe. */
export function swipeDirection(start: TouchPoint, end: TouchPoint): SwipeDirection | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (end.t - start.t > MAX_DURATION_MS) return null;
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < 2 * Math.abs(dy)) return null;
  return dx < 0 ? 'left' : 'right';
}

/** Whether the touch began in something that scrolls sideways itself (tabs, wide tables). */
function inHorizontalScroller(target: EventTarget | null, host: Element): boolean {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== host;
    el = el.parentElement
  ) {
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true;
    }
  }
  return false;
}

/**
 * Calls `handler` when the user swipes sideways on the current component's host element (plan
 * §13.5). Touch events rather than pointer events: the browser cancels a pointer stream as soon as it
 * starts panning, while touch events still end normally. The listeners are passive, so vertical
 * scrolling is never delayed. Call it in an injection context (a constructor).
 */
export function onHorizontalSwipe(handler: (direction: SwipeDirection) => void): void {
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const view = inject(DOCUMENT).defaultView;
  let start: TouchPoint | null = null;

  const onStart = (event: TouchEvent) => {
    start = null;
    const touch = event.touches[0];
    if (!view || !touch || event.touches.length !== 1) return;
    if (touch.clientX < EDGE || touch.clientX > view.innerWidth - EDGE) return;
    if (inHorizontalScroller(event.target, host)) return;
    start = { x: touch.clientX, y: touch.clientY, t: event.timeStamp };
  };
  const onEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    const from = start;
    start = null;
    if (!from || !touch) return;
    // A long-press that selected text is not a swipe.
    if (view?.getSelection()?.isCollapsed === false) return;
    const direction = swipeDirection(from, {
      x: touch.clientX,
      y: touch.clientY,
      t: event.timeStamp,
    });
    if (direction) handler(direction);
  };
  const onCancel = () => (start = null);

  const options = { passive: true } as const;
  host.addEventListener('touchstart', onStart, options);
  host.addEventListener('touchend', onEnd, options);
  host.addEventListener('touchcancel', onCancel, options);
  inject(DestroyRef).onDestroy(() => {
    host.removeEventListener('touchstart', onStart);
    host.removeEventListener('touchend', onEnd);
    host.removeEventListener('touchcancel', onCancel);
  });
}
