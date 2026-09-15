import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { getGame, isGameId } from '../../core/games/registry';
import { PROFILE_NAME_MAX } from '../../core/domain/persisted-state';
import { ProfileStore } from '../../core/profiles/profile.store';

/** `/:game/welcome` (plan §11.3): names the first profile for a game. */
@Component({
  selector: 'app-onboarding-page',
  imports: [FormField, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Start your {{ gameName() }} run</h1>
    <p>
      A profile keeps track of which Pokémon you have caught. Everything is saved in this browser
      only — nothing is uploaded. You can create more profiles later.
    </p>

    <form (submit)="create($event)">
      <mat-form-field appearance="outline">
        <mat-label>Profile name</mat-label>
        <input
          matInput
          [formField]="profileForm.name"
          placeholder="My {{ gameName() }} run"
          autocomplete="off"
        />
        <mat-hint>{{ profileForm.name().value().length }}/{{ nameMax }}</mat-hint>
      </mat-form-field>

      <div class="actions">
        <button matButton="filled" type="submit" [disabled]="profileForm().invalid()">
          Create profile
        </button>
        <a matButton [routerLink]="['/', game(), 'guide']">Skip for now</a>
      </div>
    </form>
  `,
  styles: `
    p {
      max-width: 60ch;
      color: var(--mat-sys-on-surface-variant);
    }
    form {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    mat-form-field {
      width: min(320px, 100%);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
  `,
})
export class OnboardingPage {
  private readonly profiles = inject(ProfileStore);
  private readonly router = inject(Router);

  /** Route param, bound by `withComponentInputBinding`. */
  readonly game = input.required<string>();

  protected readonly nameMax = PROFILE_NAME_MAX;
  protected readonly gameName = computed(() => {
    const id = this.game();
    return isGameId(id) ? getGame(id).name : '';
  });

  private readonly model = signal({ name: '' });
  protected readonly profileForm = form(this.model, (path) => {
    // The store trims and re-validates; these rules only drive the button and the hint.
    required(path.name, { message: 'Give the profile a name' });
    maxLength(path.name, this.nameMax);
  });

  protected create(event: Event): void {
    event.preventDefault();
    const id = this.game();
    if (!isGameId(id)) return;
    void submit(this.profileForm, async (form) => {
      this.profiles.createProfile(form().value().name, id);
      await this.router.navigate(['/', id, 'guide']);
    });
  }
}
