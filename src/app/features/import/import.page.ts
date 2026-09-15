import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { GameDataService } from '../../core/data/game-data.service';
import { parseBackup } from '../../core/domain/backup';
import { decodeProfile, type DecodedProfile } from '../../core/domain/export-codec';
import type { GameId, Profile } from '../../core/domain/models';
import { PROFILE_NAME_MAX } from '../../core/domain/persisted-state';
import { findGame } from '../../core/games/registry';
import { ProfileStore } from '../../core/profiles/profile.store';
import { ProfileSwitcherService } from '../../core/profiles/profile-switcher.service';
import { SettingsStore } from '../../core/settings/settings.store';

/** `/import` (plan §12.4): paste a code, open a share link, or restore a JSON backup. */
@Component({
  selector: 'app-import-page',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Import progress</h1>
    <p class="sub">
      Paste a <code>PKG1-</code> code or a share link to bring a profile from another device, or
      restore a JSON backup of every profile.
    </p>

    <label class="field">
      <span>Code or link</span>
      <textarea
        rows="3"
        autocomplete="off"
        spellcheck="false"
        placeholder="PKG1-…"
        [value]="input()"
        (input)="onInput($event)"
      ></textarea>
    </label>

    @if (error(); as message) {
      <p class="status error" role="alert">{{ message }}</p>
    }

    @if (decoded(); as preview) {
      <section class="card preview">
        <h2>{{ preview.name || 'Unnamed profile' }}</h2>
        <p class="meta">
          <span class="chip">{{ gameName(preview.game) }}</span>
          <span>{{ preview.caught.length }} caught{{ obtainableSuffix(preview) }}</span>
          @if (preview.progressPart; as part) {
            <span>· Part {{ part }}</span>
          }
        </p>
        @if (preview.ignoredBeyondDex; as ignored) {
          <p class="sub">
            {{ ignored }} caught Pokémon in this code are outside {{ gameName(preview.game) }}’s
            Pokédex here and will be left out.
          </p>
        }

        <div class="actions">
          <button matButton="filled" type="button" (click)="importAsNew(preview)">
            Import as new profile
          </button>
          @if (replaceable(preview).length) {
            <label class="field inline">
              <span>Replace</span>
              <select [value]="replaceId()" (change)="onReplaceTarget($event)">
                <option value="">choose a profile…</option>
                @for (profile of replaceable(preview); track profile.id) {
                  <option [value]="profile.id">
                    {{ profile.name }} ({{ profile.caught.length }} caught)
                  </option>
                }
              </select>
            </label>
            <button
              matButton
              type="button"
              [disabled]="!replaceId() || !confirmingReplace()"
              (click)="importAsReplace(preview)"
            >
              {{ confirmingReplace() ? 'Yes, overwrite it' : 'Replace' }}
            </button>
            @if (replaceId() && !confirmingReplace()) {
              <button matButton type="button" (click)="confirmingReplace.set(true)">
                Replace “{{ replaceName() }}”…
              </button>
            }
          }
        </div>
      </section>
    }

    <section class="backup">
      <h2>Restore a backup</h2>
      <p class="sub">
        A backup file holds every profile. Restoring adds them all as new profiles; nothing is
        overwritten.
      </p>
      <label class="file">
        <input type="file" accept="application/json,.json" (change)="onFile($event)" />
      </label>
      @if (backupStatus(); as text) {
        <p class="status" role="status">{{ text }}</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 70ch;
    }
    .sub {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .field {
      display: grid;
      gap: 4px;
      margin: 16px 0;
      font: var(--mat-sys-label-large);
    }
    .field.inline {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.85rem;
      word-break: break-all;
    }
    select {
      min-width: 0;
      max-width: 100%;
      min-height: 36px;
      padding: 0 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }
    .card {
      padding: 12px 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    .preview h2 {
      margin: 0;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .chip {
      padding: 2px 8px;
      border-radius: 8px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
    }
    .status {
      color: var(--mat-sys-on-surface-variant);
    }
    .status.error {
      color: var(--mat-sys-error);
    }
    .backup {
      margin-top: 32px;
    }
  `,
})
export class ImportPage {
  private readonly router = inject(Router);
  private readonly profiles = inject(ProfileStore);
  private readonly switcher = inject(ProfileSwitcherService);
  private readonly settings = inject(SettingsStore);
  private readonly gameData = inject(GameDataService);
  /** `ActivatedRoute.fragment` is only available as an Observable, so it is converted once here. */
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });

  /**
   * A share link puts the code in the fragment (`/import#PKG1-…`), so it never reaches a server.
   * The field starts from it and the user can paste over it.
   */
  protected readonly input = linkedSignal(() => this.fragment() ?? '');
  protected readonly replaceId = signal('');
  protected readonly confirmingReplace = signal(false);
  protected readonly backupStatus = signal('');

  private readonly result = computed(() => {
    const text = this.input().trim();
    return text === '' ? undefined : decodeProfile(text);
  });

  protected readonly decoded = computed(() => {
    const result = this.result();
    return result?.ok ? result.value : undefined;
  });

  protected readonly error = computed(() => {
    const result = this.result();
    return result && !result.ok ? result.error.message : '';
  });

  protected readonly replaceName = computed(
    () => this.profiles.profiles().find((p) => p.id === this.replaceId())?.name ?? '',
  );

  protected gameName(game: GameId): string {
    return findGame(game)?.name ?? game;
  }

  /** Only profiles for the same game can be replaced (plan §12.4). */
  protected replaceable(preview: DecodedProfile): Profile[] {
    return this.profiles.profiles().filter((profile) => profile.game === preview.game);
  }

  /** "of 135 obtainable" once that game's data has loaded; silent until then. */
  protected obtainableSuffix(preview: DecodedProfile): string {
    const data = untracked(() => this.gameData.forGame(preview.game));
    const obtainable = data.checklist().filter((entry) => entry.obtainable).length;
    return obtainable > 0 ? ` of ${obtainable} obtainable` : '';
  }

  protected onInput(event: Event): void {
    this.input.set((event.target as HTMLTextAreaElement).value);
    this.replaceId.set('');
    this.confirmingReplace.set(false);
  }

  protected onReplaceTarget(event: Event): void {
    this.replaceId.set((event.target as HTMLSelectElement).value);
    this.confirmingReplace.set(false);
  }

  protected async importAsNew(preview: DecodedProfile): Promise<void> {
    const id = this.profiles.importProfile(
      {
        name: this.uniqueName(preview.name),
        game: preview.game,
        caught: preview.caught,
        ...partOf(preview),
      },
      'new',
    );
    await this.finish(id);
  }

  protected async importAsReplace(preview: DecodedProfile): Promise<void> {
    const id = this.profiles.importProfile(
      { name: preview.name, game: preview.game, caught: preview.caught, ...partOf(preview) },
      'replace',
      this.replaceId(),
    );
    await this.finish(id);
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const result = parseBackup(await file.text());
    input.value = '';
    if (!result.ok) {
      this.backupStatus.set(result.error.message);
      return;
    }
    let restored = 0;
    for (const profile of result.value.profiles) {
      if (!findGame(profile.game)) continue;
      this.profiles.importProfile(
        {
          name: this.uniqueName(profile.name),
          game: profile.game,
          caught: profile.caught,
          ...(profile.progressPart === undefined ? {} : { progressPart: profile.progressPart }),
        },
        'new',
      );
      restored++;
    }
    const skipped = result.value.profiles.length - restored;
    this.backupStatus.set(
      restored === 0
        ? 'None of those profiles are for a game this version supports.'
        : `Restored ${restored} profile${restored === 1 ? '' : 's'}` +
            (skipped > 0 ? `, skipped ${skipped} for unsupported games.` : '.'),
    );
  }

  /** "My Red run" → "My Red run (2)" when that name is taken (plan §12.4). */
  private uniqueName(name: string): string {
    const taken = new Set(this.profiles.profiles().map((profile) => profile.name));
    if (!taken.has(name)) return name;
    for (let n = 2; n < 100; n++) {
      const candidate = `${name} (${n})`.slice(0, PROFILE_NAME_MAX);
      if (!taken.has(candidate)) return candidate;
    }
    return name;
  }

  /** Activates the imported profile, clears the fragment and opens its checklist. */
  private async finish(id: string): Promise<void> {
    this.profiles.setActive(id);
    // The progress now exists in this browser as well, so the save reminder starts over.
    this.settings.set('changesSinceExport', 0);
    const game = this.profiles.profiles().find((profile) => profile.id === id)?.game;
    await this.router.navigate(['/', game, 'checklist'], { replaceUrl: true });
    await this.switcher.followActiveProfile();
  }
}

function partOf(preview: DecodedProfile): { progressPart?: number } {
  return preview.progressPart === undefined ? {} : { progressPart: preview.progressPart };
}
