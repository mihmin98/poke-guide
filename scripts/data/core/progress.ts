/**
 * Progress feedback for the throttled API client. On a terminal it draws one line (bar, count,
 * countdown to the next request, ETA) while a request is pending and clears it once the response
 * arrives, so other output never lands on the bar. Elsewhere it prints one plain line per request.
 */

export interface ProgressStream {
  write(text: string): unknown;
  isTTY?: boolean;
}

export interface RequestProgressOptions {
  stream: ProgressStream;
  /** Shown before the bar: `Bulbapedia`. */
  label?: string;
  now?: () => number;
  /** Time per request assumed for the ETA until one has been measured (the average random gap). */
  assumedRequestMs?: number;
  barWidth?: number;
}

const CLEAR_LINE = '\r\x1b[2K';
const COUNTDOWN_STEP_MS = 1000;

/** `16 s`, `4 min 05 s`, `1 h 02 min`. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export class RequestProgress {
  private readonly stream: ProgressStream;
  private readonly label: string;
  private readonly now: () => number;
  private readonly assumedRequestMs: number;
  private readonly barWidth: number;
  private readonly tty: boolean;
  private expected = 0;
  private completed = 0;
  private startedAt: number | null = null;
  private lastDoneAt: number | null = null;
  private lineShown = false;

  constructor(options: RequestProgressOptions) {
    this.stream = options.stream;
    this.label = options.label ?? 'Bulbapedia';
    this.now = options.now ?? Date.now;
    this.assumedRequestMs = options.assumedRequestMs ?? 3500;
    this.barWidth = options.barWidth ?? 20;
    this.tty = options.stream.isTTY === true;
  }

  /** Announces `count` more requests; the total may grow while running (continuations, retries). */
  expect(count: number): void {
    this.startedAt ??= this.now();
    this.expected += count;
  }

  /** Sleeps `ms` before the next request, counting down on a terminal. */
  async wait(ms: number, sleep: (ms: number) => Promise<void>): Promise<void> {
    if (!this.tty) return sleep(ms);
    for (let left = ms; left > 0; left -= COUNTDOWN_STEP_MS) {
      this.draw(`next request in ${Math.ceil(left / 1000)} s`);
      await sleep(Math.min(COUNTDOWN_STEP_MS, left));
    }
  }

  /** The request is on its way. */
  sending(): void {
    this.startedAt ??= this.now();
    if (this.tty) this.draw('waiting for the response');
  }

  /** A response (or a network error) arrived. */
  done(): void {
    this.completed++;
    this.expected = Math.max(this.expected, this.completed);
    this.lastDoneAt = this.now();
    if (this.tty) this.clear();
    else this.stream.write(`${this.label} [${this.counter()}] · ETA ~${formatDuration(this.etaMs())}\n`);
  }

  /** Writes a message on its own line without breaking the bar. */
  print(message: string): void {
    const shown = this.lineShown;
    this.clear();
    this.stream.write(`${message}\n`);
    if (shown) this.draw('');
  }

  /** Clears the bar and prints the totals (nothing if no request was made). */
  finish(): void {
    this.clear();
    if (this.completed === 0 || this.startedAt === null) return;
    const plural = this.completed === 1 ? '' : 's';
    this.stream.write(
      `${this.label}: ${this.completed} request${plural} in ${formatDuration(this.now() - this.startedAt)}\n`,
    );
  }

  /** Remaining requests × the measured time per request, less the time since the last response. */
  etaMs(): number {
    const remaining = this.expected - this.completed;
    if (remaining <= 0) return 0;
    const perRequest =
      this.completed > 0 && this.startedAt !== null && this.lastDoneAt !== null
        ? (this.lastDoneAt - this.startedAt) / this.completed
        : this.assumedRequestMs;
    const sinceLast = this.lastDoneAt === null ? 0 : this.now() - this.lastDoneAt;
    return Math.max(0, remaining * perRequest - sinceLast);
  }

  private counter(): string {
    const percent = this.expected === 0 ? 0 : Math.floor((this.completed / this.expected) * 100);
    return `${this.completed}/${this.expected} ${percent}%`;
  }

  private draw(status: string): void {
    const filled =
      this.expected === 0 ? 0 : Math.round((this.completed / this.expected) * this.barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(this.barWidth - filled);
    const parts = [`${this.label} ▕${bar}▏ ${this.counter()}`];
    if (status) parts.push(status);
    parts.push(`ETA ~${formatDuration(this.etaMs())}`);
    this.stream.write(CLEAR_LINE + parts.join(' · '));
    this.lineShown = true;
  }

  private clear(): void {
    if (!this.lineShown) return;
    this.stream.write(CLEAR_LINE);
    this.lineShown = false;
  }
}
