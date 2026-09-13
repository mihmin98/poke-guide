import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>About Poké Guide</h1>
    <p>
      A companion for catching every Pokémon you can get without trading with another player, area
      by area, in walkthrough order.
    </p>

    <h2>Data</h2>
    <p>
      Encounter data from
      <a href="https://bulbapedia.bulbagarden.net/" rel="noopener" target="_blank">Bulbapedia</a>,
      the community-driven Pokémon encyclopedia. Bulbapedia content is licensed under
      <a href="https://creativecommons.org/licenses/by-nc-sa/2.5/" rel="noopener" target="_blank"
        >CC BY-NC-SA 2.5</a
      >, and the data derived from it in this app is shared under the same terms. Each location
      links to its source page.
    </p>

    <h2>Disclaimer</h2>
    <p>
      Poké Guide is an unofficial fan project. It is not affiliated with or endorsed by Nintendo,
      Creatures, GAME FREAK or The Pokémon Company. Pokémon names and sprites are © Nintendo,
      Creatures and GAME FREAK; sprites come from Bulbagarden Archives.
    </p>
  `,
  styles: `
    p {
      max-width: 70ch;
    }
    a {
      color: var(--mat-sys-primary);
    }
  `,
})
export class AboutPage {}
