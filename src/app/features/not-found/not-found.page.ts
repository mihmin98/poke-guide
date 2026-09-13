import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Page not found</h1>
    <p><a routerLink="/games">Choose a game</a></p>
  `,
  styles: `
    a {
      color: var(--mat-sys-primary);
    }
  `,
})
export class NotFoundPage {}
