import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PROFILE_NAME_MAX } from '../../core/domain/persisted-state';
import type { GameId } from '../../core/domain/models';
import type { GameDefinition } from '../../core/games/types';

export interface ProfileNameDialogData {
  title: string;
  confirmLabel: string;
  name: string;
  /** When set, the dialog also asks for a game (creating a profile). */
  games?: readonly GameDefinition[];
  game?: GameId;
}

export interface ProfileNameDialogResult {
  name: string;
  game: GameId;
}

/** Names a profile, and picks its game when creating one. */
@Component({
  selector: 'app-profile-name-dialog',
  imports: [
    FormField,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline">
        <mat-label>Profile name</mat-label>
        <input matInput [formField]="nameForm.name" autocomplete="off" />
        <mat-hint>{{ nameForm.name().value().length }}/{{ nameMax }}</mat-hint>
      </mat-form-field>
      @if (data.games; as games) {
        <mat-form-field appearance="outline">
          <mat-label>Game</mat-label>
          <!-- mat-select is not a Signal Forms control yet, so it uses a signal two-way binding. -->
          <mat-select [(value)]="game">
            @for (option of games; track option.id) {
              <mat-option [value]="option.id">{{ option.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button matButton="filled" type="button" [disabled]="!canConfirm()" (click)="confirm()">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      padding-top: 8px;
    }
    mat-form-field {
      width: min(320px, 100%);
    }
  `,
})
export class ProfileNameDialog {
  private readonly dialogRef =
    inject<MatDialogRef<ProfileNameDialog, ProfileNameDialogResult>>(MatDialogRef);
  protected readonly data = inject<ProfileNameDialogData>(MAT_DIALOG_DATA);

  protected readonly nameMax = PROFILE_NAME_MAX;
  protected readonly game = signal(this.data.game ?? this.data.games?.[0]?.id);

  private readonly model = signal({ name: this.data.name });
  protected readonly nameForm = form(this.model, (path) => {
    required(path.name, { message: 'Give the profile a name' });
    maxLength(path.name, this.nameMax);
  });

  protected readonly canConfirm = computed(() => this.nameForm().valid() && !!this.game());

  protected confirm(): void {
    void submit(this.nameForm, async (form) => {
      const game = this.game();
      if (game) this.dialogRef.close({ name: form().value().name, game });
    });
  }
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
}

/** A yes/no confirmation; closes with `true` when confirmed. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancel</button>
      <button matButton="filled" [mat-dialog-close]="true">{{ data.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
