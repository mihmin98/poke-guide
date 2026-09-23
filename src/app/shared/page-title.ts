import { effect, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Replaces the route's generic title ("Location · Poké Guide") with a specific one once the page's data
 * has loaded, so tabs, history and screen readers name the actual place or species. Call it in an
 * injection context; `title` returns `undefined` while there is nothing to name yet.
 */
export function pageTitle(title: () => string | undefined): void {
  const document = inject(Title);
  effect(() => {
    const text = title();
    if (text) document.setTitle(`${text} · Poké Guide`);
  });
}
