import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { Settings } from '../../core/domain/persisted-state';
import { SettingsStore } from '../../core/settings/settings.store';

type BooleanSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

interface ToggleRow {
  id: string;
  label: string;
  hint: string;
  checked: (settings: Settings) => boolean;
  set: (on: boolean) => void;
}

/** Global display settings (plan §11.4). They are stored in this browser and never exported. */
@Component({
  selector: 'app-settings-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Settings</h1>
    <p class="intro">
      Settings apply to every profile and are saved in this browser only. They are not part of
      export codes.
    </p>

    <section aria-labelledby="appearance">
      <h2 id="appearance">Appearance</h2>
      <div class="setting">
        <span class="text">
          <span class="label" id="theme-label">Theme</span>
          <span class="hint">System follows your device's light or dark setting.</span>
        </span>
        <mat-button-toggle-group
          aria-labelledby="theme-label"
          [value]="settings().theme"
          (change)="store.set('theme', $event.value)"
        >
          @for (option of themes; track option.value) {
            <mat-button-toggle [value]="option.value">
              <mat-icon aria-hidden="true">{{ option.icon }}</mat-icon>
              {{ option.label }}
            </mat-button-toggle>
          }
        </mat-button-toggle-group>
      </div>
      @for (row of appearance; track row.id) {
        <ng-container [ngTemplateOutlet]="toggle" [ngTemplateOutletContext]="{ $implicit: row }" />
      }
    </section>

    <section aria-labelledby="guide">
      <h2 id="guide">Guide</h2>
      @for (row of guide; track row.id) {
        <ng-container [ngTemplateOutlet]="toggle" [ngTemplateOutletContext]="{ $implicit: row }" />
      }
    </section>

    <section aria-labelledby="checklist">
      <h2 id="checklist">Checklist</h2>
      <div class="setting">
        <span class="text">
          <label class="label" for="sort">Sort order</label>
          <span class="hint">Also changes when you pick a sort on the checklist.</span>
        </span>
        <select id="sort" [value]="settings().checklistSort" (change)="setSort($event)">
          @for (option of sorts; track option.value) {
            <option [value]="option.value">{{ option.label }}</option>
          }
        </select>
      </div>
    </section>

    <section aria-labelledby="data">
      <h2 id="data">Your data</h2>
      <p class="hint">
        Progress lives in this browser. Back it up from
        <a routerLink="/profiles">Profiles</a> (export code or backup file), and restore it from
        <a routerLink="/import">Import</a>.
      </p>
      <button matButton="outlined" type="button" (click)="reset()">
        <mat-icon aria-hidden="true">restart_alt</mat-icon>
        Reset settings to defaults
      </button>
    </section>

    <ng-template #toggle let-row>
      <div class="setting">
        <span class="text">
          <span class="label" [id]="row.id + '-label'">{{ row.label }}</span>
          <span class="hint">{{ row.hint }}</span>
        </span>
        <mat-slide-toggle
          [aria-labelledby]="row.id + '-label'"
          [checked]="row.checked(settings())"
          (change)="row.set($event.checked)"
        />
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }
    .intro {
      color: var(--mat-sys-on-surface-variant);
    }
    section {
      margin-top: 24px;
    }
    .setting {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 16px;
      min-height: 56px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .text {
      display: grid;
      gap: 2px;
      flex: 1 1 240px;
      min-width: 0;
    }
    .label {
      font: var(--mat-sys-body-large);
    }
    .hint {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    select {
      min-height: 40px;
      max-width: 100%;
      padding: 0 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
    mat-button-toggle mat-icon {
      margin-inline-end: 4px;
      vertical-align: middle;
    }
  `,
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly settings = this.store.settings;

  protected readonly themes = [
    { value: 'system', label: 'System', icon: 'brightness_auto' },
    { value: 'light', label: 'Light', icon: 'light_mode' },
    { value: 'dark', label: 'Dark', icon: 'dark_mode' },
  ] as const;

  protected readonly sorts = [
    { value: 'national', label: 'National Dex' },
    { value: 'regional', label: 'Regional Dex' },
    { value: 'walkthrough', label: 'Walkthrough order' },
  ] as const;

  protected readonly appearance: ToggleRow[] = [
    {
      id: 'sprite-scale',
      label: 'Larger sprites',
      hint: 'Bigger sprites in the guide, location and checklist lists.',
      checked: (s) => s.spriteScale === 3,
      set: (on) => this.store.set('spriteScale', on ? 3 : 2),
    },
    this.flag(
      'compactRows',
      'Compact rows',
      'Tighter encounter and checklist rows, so more fit on screen.',
    ),
  ];

  protected readonly guide: ToggleRow[] = [
    this.flag('showRates', 'Encounter rates', 'The % chance of each encounter slot.'),
    this.flag(
      'showCatchRates',
      'Catch rates',
      'The species catch rate (CR), linked to the catch calculator.',
    ),
    this.flag(
      'showEmptyLocations',
      'Locations with no Pokémon',
      'Places with nothing to catch, such as towns and shops.',
    ),
    this.flag(
      'hideUnavailable',
      'Only locations available now',
      "Hide locations past the walkthrough part you're on (set on the checklist).",
    ),
    this.flag(
      'guideShowStory',
      'Story steps in the guide',
      'Gyms, battles and events between the locations, for games with a story checklist.',
    ),
  ];

  protected setSort(event: Event): void {
    this.store.set(
      'checklistSort',
      (event.target as HTMLSelectElement).value as Settings['checklistSort'],
    );
  }

  private flag(key: BooleanSetting, label: string, hint: string): ToggleRow {
    return {
      id: key,
      label,
      hint,
      checked: (s) => s[key],
      set: (on) => this.store.set(key, on),
    };
  }

  protected reset(): void {
    this.store.reset();
    this.snackBar.open('Settings reset to defaults', undefined, { duration: 4000 });
  }
}
