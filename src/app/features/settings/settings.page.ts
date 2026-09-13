import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Settings</h1>
    <p>Theme and display settings will appear here (Phase 2).</p>
  `,
})
export class SettingsPage {}
