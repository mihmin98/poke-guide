/**
 * Polite MediaWiki API client for Bulbapedia: batched `titles=` (≤ 50), ≤ 1 request/s, `maxlag=5`,
 * a descriptive User-Agent, and exponential backoff on 429/5xx/maxlag honoring `Retry-After`.
 */
import { z } from 'zod';

export const BULBAPEDIA_API = 'https://bulbapedia.bulbagarden.net/w/api.php';
export const BULBAPEDIA_WIKI = 'https://bulbapedia.bulbagarden.net/wiki/';
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

export interface MediaWikiClientOptions {
  endpoint?: string;
  userAgent?: string;
  minIntervalMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
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
            imageinfo: z.array(z.object({ url: z.string() })).optional(),
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
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly log: (message: string) => void;
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  requestCount = 0;

  constructor(options: MediaWikiClientOptions = {}) {
    this.endpoint = options.endpoint ?? BULBAPEDIA_API;
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 5;
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
    this.log = options.log ?? (() => undefined);
  }

  /** Latest revision wikitext per requested title; `null` for missing or invalid pages. Follows redirects. */
  async getPages(titles: readonly string[]): Promise<Map<string, FetchedPage | null>> {
    const result = new Map<string, FetchedPage | null>();
    for (const batch of chunk([...new Set(titles)], MAX_TITLES_PER_REQUEST)) {
      const normalized = new Map<string, string>();
      const redirects = new Map<string, string>();
      const pageByTitle = new Map<
        string,
        NonNullable<z.infer<typeof revisionsResponse>['query']>['pages'][number]
      >();
      let continuation: Record<string, string> = {};
      do {
        const body = revisionsResponse.parse(
          await this.request({
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

  /** Direct file URLs for `File:` titles; `null` for missing files. */
  async getImageUrls(fileTitles: readonly string[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    for (const batch of chunk([...new Set(fileTitles)], MAX_TITLES_PER_REQUEST)) {
      const body = imageInfoResponse.parse(
        await this.request({
          action: 'query',
          prop: 'imageinfo',
          iiprop: 'url',
          titles: batch.join('|'),
        }),
      );
      const normalized = new Map((body.query?.normalized ?? []).map((n) => [n.from, n.to]));
      const pages = new Map((body.query?.pages ?? []).map((p) => [p.title, p]));
      for (const title of batch) {
        const page = pages.get(normalized.get(title) ?? title);
        result.set(title, page?.imageinfo?.[0]?.url ?? null);
      }
    }
    return result;
  }

  /** Main-namespace (and category-namespace) member titles of a category. */
  async getCategoryMembers(category: string): Promise<string[]> {
    const titles: string[] = [];
    let continuation: Record<string, string> = {};
    do {
      const body = categoryResponse.parse(
        await this.request({
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
    const url = new URL(this.endpoint);
    const query = { format: 'json', formatversion: '2', maxlag: '5', ...params };
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const retry = async (reason: string, retryAfterMs: number | null) => {
        if (attempt >= this.maxRetries) {
          throw new MediaWikiError(`${reason} after ${attempt + 1} attempts: ${url}`);
        }
        const delay = retryAfterMs ?? 1000 * 2 ** attempt;
        this.log(`${reason}; retrying in ${delay} ms`);
        await this.sleep(delay);
      };

      let response: Response;
      try {
        this.requestCount++;
        response = await this.fetchImpl(url, {
          headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
        });
      } catch (error) {
        await retry(`Network error (${(error as Error).message})`, null);
        continue;
      }

      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      if (response.status === 429 || response.status >= 500) {
        await retry(`HTTP ${response.status}`, retryAfter);
        continue;
      }
      if (!response.ok) throw new MediaWikiError(`HTTP ${response.status}: ${url}`);

      const body = (await response.json()) as { error?: { code?: string; info?: string } };
      if (body.error?.code === 'maxlag') {
        await retry('Server lagged (maxlag)', retryAfter);
        continue;
      }
      if (body.error) {
        throw new MediaWikiError(`API error ${body.error.code}: ${body.error.info ?? ''}`);
      }
      return body;
    }
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = this.now();
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}
