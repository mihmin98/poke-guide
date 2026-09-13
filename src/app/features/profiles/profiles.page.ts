import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-profiles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Profiles</h1>
    <p>Create, switch, import and export profiles here (Phase 2).</p>
  `,
})
export class ProfilesPage {}
