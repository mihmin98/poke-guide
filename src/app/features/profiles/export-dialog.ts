import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { encodeProfile } from '../../core/domain/export-codec';
import type { Profile } from '../../core/domain/models';
import { findGame } from '../../core/games/registry';
import { SettingsStore } from '../../core/settings/settings.store';
import { linkQrCode } from './qr-svg';

export interface ExportDialogData {
  profile: Profile;
}

/** Copies text, preferring the async clipboard and falling back to a hidden textarea. */
async function copyText(document: Document, text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  }
}

/**
 * The export dialog (plan §12.3): the code (`PKG1`, or `PKG2` once items are ticked), a share link,
 * and the system share sheet.
 */
@Component({
  selector: 'app-export-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Export “{{ data.profile.name }}”</h2>
    <mat-dialog-content>
      <p class="sub">
        This code holds {{ data.profile.caught.length }} caught Pokémon
        @if (data.profile.itemsTaken.length; as items) {
          and {{ items }} picked-up {{ items === 1 ? 'item' : 'items' }}
        }
        for {{ gameName() }}. Paste it into Poké Guide on another device, or keep it somewhere safe.
      </p>

      <label class="field">
        <span class="sr-only">Export code</span>
        <textarea readonly rows="3" [value]="code()" (focus)="selectAll($event)"></textarea>
      </label>

      <div class="actions">
        <button matButton="filled" type="button" (click)="copy(code())">
          <mat-icon aria-hidden="true">content_copy</mat-icon>
          Copy code
        </button>
        <button matButton type="button" (click)="copy(link())">
          <mat-icon aria-hidden="true">link</mat-icon>
          Copy link
        </button>
        @if (canShare()) {
          <button matButton type="button" (click)="share()">
            <mat-icon aria-hidden="true">share</mat-icon>
            Share…
          </button>
        }
        <button
          matButton
          type="button"
          [attr.aria-expanded]="showQr()"
          aria-controls="export-qr"
          (click)="showQr.set(!showQr())"
        >
          <mat-icon aria-hidden="true">qr_code_2</mat-icon>
          {{ showQr() ? 'Hide QR code' : 'QR code' }}
        </button>
      </div>

      <div id="export-qr">
        @if (showQr()) {
          @if (qr.value(); as code) {
            <svg
              class="qr"
              role="img"
              aria-label="QR code of the share link"
              shape-rendering="crispEdges"
              [attr.viewBox]="'0 0 ' + code.size + ' ' + code.size"
            >
              <rect [attr.width]="code.size" [attr.height]="code.size" fill="#fff" />
              <path [attr.d]="code.path" fill="#000" />
            </svg>
            <p class="sub">
              Scan it with the other device's camera to open the import page with this code.
            </p>
          } @else if (qr.error()) {
            <p class="status" role="status">The QR code could not be created.</p>
          }
        }
      </div>

      @if (status(); as text) {
        <p class="status" role="status">{{ text }}</p>
      }

      <p class="sub">
        The code travels in the link’s <code>#fragment</code>, so it is never sent to a server.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sub {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.85rem;
      word-break: break-all;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .qr {
      display: block;
      width: min(100%, 240px);
      margin: 0 auto;
      border-radius: 8px;
    }
    .status {
      margin: 0;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ExportDialog {
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(SettingsStore);

  protected readonly data = inject<ExportDialogData>(MAT_DIALOG_DATA);
  protected readonly status = signal('');

  protected readonly code = computed(() => encodeProfile(this.data.profile));
  protected readonly gameName = computed(
    () => findGame(this.data.profile.game)?.name ?? this.data.profile.game,
  );
  protected readonly link = computed(
    // `baseURI` carries the base href, so the link also works under the GitHub Pages sub-path.
    () => `${new URL('import', this.document.baseURI).href}#${this.code()}`,
  );
  protected readonly canShare = computed(() => typeof navigator.share === 'function');

  protected readonly showQr = signal(false);
  /** Idle until the QR code is first shown, so the generator stays out of the dialog's chunk. */
  protected readonly qr = resource({
    params: () => (this.showQr() ? this.link() : undefined),
    loader: ({ params: link }) => linkQrCode(link),
  });

  protected selectAll(event: Event): void {
    (event.target as HTMLTextAreaElement).select();
  }

  protected async copy(text: string): Promise<void> {
    const copied = await copyText(this.document, text);
    this.status.set(copied ? 'Copied.' : 'Copying failed — select the code and copy it yourself.');
    if (copied) this.markExported();
  }

  protected async share(): Promise<void> {
    try {
      await navigator.share({ title: 'Poké Guide progress', text: this.code() });
      this.markExported();
    } catch {
      // The user dismissed the share sheet, or sharing is unavailable; nothing to report.
    }
  }

  /** Clears the save-reminder counter: the progress now exists outside this browser. */
  private markExported(): void {
    this.settings.set('changesSinceExport', 0);
  }
}
