/**
 * Polite MediaWiki API client for Bulbapedia: batched `titles=` (≤ 50), a random 2–5 s gap between
 * requests, `maxlag=5`, a descriptive User-Agent, and exponential backoff on 429/5xx/maxlag honoring
 * `Retry-After`. Any other error status (such as a 403 challenge) fails at once, without retrying.
 */
import { z } from 'zod';
import type { RequestProgress } from './progress';

export const BULBAPEDIA_API = 'https://bulbapedia.bulbagarden.net/w/api.php';
export const BULBAPEDIA_WIKI = 'https://bulbapedia.bulbagarden.net/wiki/';
/** Bulbagarden Archives hosts the sprite files (plan §7.10). */
export const ARCHIVES_API = 'https://archives.bulbagarden.net/w/api.php';
// TODO(Phase 8): add the repository URL once it exists.
export const USER_AGENT =
  'poke-guide-data-builder/0.1 (non-commercial fan companion app; build-time data fetch, cached)';

const MAX_TITLES_PER_REQUEST = 50;

export function wikiUrl(title: string): string {
  return BULBAPEDIA_WIKI + encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/');
}

export interface FetchedPage {
  /** The title as requested. */
  title: string;
  /** The title after normalization and redirects. */
  resolvedTitle: string;
  revid: number;
  timestamp: string;
  wikitext: string;
}

export interface ImageInfo {
  url: string;
  /** Lowercase hex SHA-1 of the current file version. */
  sha1: string;
}

export interface MediaWikiClientOptions {
  endpoint?: string;
  userAgent?: string;
  /** The gap between request starts is drawn uniformly from [minIntervalMs, maxIntervalMs]. */
  minIntervalMs?: number;
  maxIntervalMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  log?: (message: string) => void;
  /** Progress bar and ETA; `log` messages go through it so they don't break the bar. */
  progress?: RequestProgress;
}

export class MediaWikiError extends Error {
  override name = 'MediaWikiError';
}

const titleMap = z.array(z.object({ from: z.string(), to: z.string() }));

const revisionsResponse = z.object({
  continue: z.record(z.string(), z.string()).optional(),
  query: z
    .object({
      normalized: titleMap.optional(),
      redirects: titleMap.optional(),
      pages: z
        .array(
          z.object({
            title: z.string(),
            missing: z.boolean().optional(),
            invalid: z.boolean().optional(),
            revisions: z
              .array(
                z.object({
                  revid: z.number(),
                  timestamp: z.string(),
                  slots: z.object({ main: z.object({ content: z.string() }) }),
                }),
              )
              .optional(),
          }),
        )
        .default([]),
    })
    .optional(),
});

const imageInfoResponse = z.object({
  query: z
    .object({
      normalized: titleMap.optional(),
      pages: z
        .array(
          z.object({
            title: z.string(),
            missing: z.boolean().optional(),
            imageinfo: z.array(z.object({ url: z.string(), sha1: z.string() })).optional(),
          }),
        )
        .default([]),
    })
    .optional(),
});

const categoryResponse = z.object({
  continue: z.record(z.string(), z.string()).optional(),
  query: z
    .object({ categorymembers: z.array(z.object({ title: z.string(), ns: z.number() })) })
    .optional(),
});

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export class MediaWikiClient {
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly log: (message: string) => void;
  private readonly progress: RequestProgress | undefined;
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  requestCount = 0;

  constructor(options: MediaWikiClientOptions = {}) {
    this.endpoint = options.endpoint ?? BULBAPEDIA_API;
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.minIntervalMs = options.minIntervalMs ?? 2000;
    this.maxIntervalMs = Math.max(this.minIntervalMs, options.maxIntervalMs ?? 5000);
    this.maxRetries = options.maxRetries ?? 5;
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.progress = options.progress;
    const log = options.log ?? (() => undefined);
    this.log = this.progress ? (message) => this.progress!.print(message) : log;
  }

  /** Announces `count` upcoming requests to the progress bar (e.g. a known number of downloads). */
  expectRequests(count: number): void {
    this.progress?.expect(count);
  }

  /** Latest revision wikitext per requested title; `null` for missing or invalid pages. Follows redirects. */
  async getPages(titles: readonly string[]): Promise<Map<string, FetchedPage | null>> {
    const result = new Map<string, FetchedPage | null>();
    const batches = chunk([...new Set(titles)], MAX_TITLES_PER_REQUEST);
    this.progress?.expect(batches.length);
    for (const batch of batches) {
      const normalized = new Map<string, string>();
      const redirects = new Map<string, string>();
      const pageByTitle = new Map<
        string,
        NonNullable<z.infer<typeof revisionsResponse>['query']>['pages'][number]
      >();
      let continuation: Record<string, string> = {};
      do {
        if (Object.keys(continuation).length > 0) this.progress?.expect(1);
        const body = revisionsResponse.parse(
          await this.query({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content|ids|timestamp',
            rvslots: 'main',
            redirects: '1',
            titles: batch.join('|'),
            ...continuation,
          }),
        );
        for (const n of body.query?.normalized ?? []) normalized.set(n.from, n.to);
        for (const r of body.query?.redirects ?? []) redirects.set(r.from, r.to);
        for (const page of body.query?.pages ?? []) {
          const known = pageByTitle.get(page.title);
          if (!known?.revisions?.length) pageByTitle.set(page.title, page);
        }
        continuation = body.continue ?? {};
      } while (Object.keys(continuation).length > 0);

      for (const title of batch) {
        let resolved = normalized.get(title) ?? title;
        const seen = new Set<string>();
        while (redirects.has(resolved) && !seen.has(resolved)) {
          seen.add(resolved);
          resolved = redirects.get(resolved)!;
        }
        const page = pageByTitle.get(resolved);
        const revision = page?.revisions?.[0];
        if (!page || page.missing || page.invalid || !revision) {
          result.set(title, null);
          continue;
        }
        result.set(title, {
          title,
          resolvedTitle: page.title,
          revid: revision.revid,
          timestamp: revision.timestamp,
          wikitext: revision.slots.main.content,
        });
      }
    }
    return result;
  }

  /** Direct URL and SHA-1 (hex) of the current version of `File:` titles; `null` for missing files. */
  async getImageInfo(fileTitles: readonly string[]): Promise<Map<string, ImageInfo | null>> {
    const result = new Map<string, ImageInfo | null>();
    const batches = chunk([...new Set(fileTitles)], MAX_TITLES_PER_REQUEST);
    this.progress?.expect(batches.length);
    for (const batch of batches) {
      const body = imageInfoResponse.parse(
        await this.query({
          action: 'query',
          prop: 'imageinfo',
          iiprop: 'url|sha1',
          titles: batch.join('|'),
        }),
      );
      const normalized = new Map((body.query?.normalized ?? []).map((n) => [n.from, n.to]));
      const pages = new Map((body.query?.pages ?? []).map((p) => [p.title, p]));
      for (const title of batch) {
        const info = pages.get(normalized.get(title) ?? title)?.imageinfo?.[0];
        result.set(title, info ? { url: info.url, sha1: info.sha1 } : null);
      }
    }
    return result;
  }

  /**
   * Downloads a file (e.g. an `imageinfo` URL) with the same throttling, User-Agent and retries.
   * Announce a batch of downloads with `expectRequests` for a meaningful ETA.
   */
  async download(url: string): Promise<Uint8Array> {
    return this.send(new URL(url), '*/*', async (response) => ({
      value: new Uint8Array(await response.arrayBuffer()),
    }));
  }

  /** Main-namespace (and category-namespace) member titles of a category. */
  async getCategoryMembers(category: string): Promise<string[]> {
    const titles: string[] = [];
    let continuation: Record<string, string> = {};
    do {
      this.progress?.expect(1);
      const body = categoryResponse.parse(
        await this.query({
          action: 'query',
          list: 'categorymembers',
          cmtitle: category,
          cmlimit: '500',
          ...continuation,
        }),
      );
      for (const member of body.query?.categorymembers ?? []) titles.push(member.title);
      continuation = body.continue ?? {};
    } while (Object.keys(continuation).length > 0);
    return titles;
  }

  /** One API request with throttling and retries. Returns the parsed JSON body. */
  async request(params: Record<string, string>): Promise<unknown> {
    this.progress?.expect(1);
    return this.query(params);
  }

  private async query(params: Record<string, string>): Promise<unknown> {
    const url = new URL(this.endpoint);
    const query = { format: 'json', formatversion: '2', maxlag: '5', ...params };
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    return this.send(url, 'application/json', async (response) => {
      const body = (await response.json()) as { error?: { code?: string; info?: string } };
      if (body.error?.code === 'maxlag') return { retry: 'Server lagged (maxlag)' };
      if (body.error) {
        throw new MediaWikiError(`API error ${body.error.code}: ${body.error.info ?? ''}`);
      }
      return { value: body };
    });
  }

  /**
   * One throttled GET with retries on network errors, 429, 5xx and whatever `read` asks to retry
   * (honoring `Retry-After`, otherwise exponential backoff).
   */
  private async send<T>(
    url: URL,
    accept: string,
    read: (response: Response) => Promise<{ value: T } | { retry: string }>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const retry = async (reason: string, retryAfterMs: number | null) => {
        if (attempt >= this.maxRetries) {
          throw new MediaWikiError(`${reason} after ${attempt + 1} attempts: ${url}`);
        }
        this.progress?.expect(1);
        const delay = retryAfterMs ?? 1000 * 2 ** attempt;
        this.log(`${reason}; retrying in ${delay} ms`);
        await this.sleep(delay);
      };

      let response: Response;
      try {
        this.requestCount++;
        this.progress?.sending();
        response = await this.fetchImpl(url, {
          headers: { 'User-Agent': this.userAgent, Accept: accept },
        });
      } catch (error) {
        this.progress?.done();
        await retry(`Network error (${(error as Error).message})`, null);
        continue;
      }
      this.progress?.done();

      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      if (response.status === 429 || response.status >= 500) {
        await retry(`HTTP ${response.status}`, retryAfter);
        continue;
      }
      if (!response.ok) throw new MediaWikiError(`HTTP ${response.status}: ${url}`);

      const outcome = await read(response);
      if ('retry' in outcome) {
        await retry(outcome.retry, retryAfter);
        continue;
      }
      return outcome.value;
    }
  }

  private async throttle(): Promise<void> {
    const span = this.maxIntervalMs - this.minIntervalMs;
    const gap = this.minIntervalMs + Math.round(this.random() * span);
    const wait = this.lastRequestAt + gap - this.now();
    if (wait > 0) await (this.progress ? this.progress.wait(wait, this.sleep) : this.sleep(wait));
    this.lastRequestAt = this.now();
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}
