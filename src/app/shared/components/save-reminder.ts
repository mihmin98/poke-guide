import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ProfileStore } from '../../core/profiles/profile.store';
import { SettingsStore } from '../../core/settings/settings.store';

/** Catch changes before the app asks the user to make a backup (plan §13.8). */
export const SAVE_REMINDER_AFTER = 30;

/**
 * "Progress is saved in this browser only" (plan §13.8). It appears once there are enough catch
 * changes since the last export. Dismissing it restarts the count, so it comes back after another
 * `SAVE_REMINDER_AFTER` changes rather than never.
 */
@Component({
  selector: 'app-save-reminder',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (show()) {
      <aside role="status">
        <mat-icon aria-hidden="true">cloud_off</mat-icon>
        <p>
          Progress is saved in this browser only. Export a backup code so you don’t lose it.
        </p>
        <a matButton="filled" routerLink="/profiles">Export</a>
        <button matIconButton type="button" aria-label="Dismiss" (click)="dismiss()">
          <mat-icon aria-hidden="true">close</mat-icon>
        </button>
      </aside>
    }
  `,
  styles: `
    aside {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin: 0 0 12px;
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    p {
      flex: 1 1 240px;
      margin: 0;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class SaveReminder {
  private readonly settings = inject(SettingsStore);
  private readonly profiles = inject(ProfileStore);

  private readonly changes = this.settings.select('changesSinceExport');

  protected readonly show = computed(
    () => this.profiles.profiles().length > 0 && this.changes() >= SAVE_REMINDER_AFTER,
  );

  protected dismiss(): void {
    this.settings.set('changesSinceExport', 0);
  }
}
