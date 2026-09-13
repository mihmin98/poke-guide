import { MediaWikiClient, MediaWikiError, USER_AGENT, wikiUrl } from './mediawiki-client';

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function revision(title: string, revid: number, content = `text of ${title}`) {
  return { title, revisions: [{ revid, timestamp: '2026-01-01T00:00:00Z', slots: { main: { content } } }] };
}

function setup(responses: ((url: URL) => Response)[]) {
  let clock = 0;
  const sleeps: number[] = [];
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input.toString());
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected request');
    return next(url);
  });
  const client = new MediaWikiClient({
    fetch: fetchMock as unknown as typeof fetch,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
  });
  return { client, calls, sleeps };
}

describe('MediaWikiClient.getPages', () => {
  it('resolves normalization and redirects, and reports missing pages', async () => {
    const { client, calls } = setup([
      () =>
        json({
          query: {
            normalized: [{ from: 'pokémon Lab', to: 'Pokémon Lab' }],
            redirects: [{ from: 'Pokémon Lab', to: 'Pokémon Research Lab' }],
            pages: [revision('Pokémon Research Lab', 42), { title: 'Nope', missing: true }],
          },
        }),
    ]);
    const pages = await client.getPages(['pokémon Lab', 'Nope']);
    expect(pages.get('pokémon Lab')).toMatchObject({
      title: 'pokémon Lab',
      resolvedTitle: 'Pokémon Research Lab',
      revid: 42,
      wikitext: 'text of Pokémon Research Lab',
    });
    expect(pages.get('Nope')).toBeNull();

    const params = calls[0]!.url.searchParams;
    expect(params.get('redirects')).toBe('1');
    expect(params.get('maxlag')).toBe('5');
    expect(params.get('formatversion')).toBe('2');
    expect(params.get('titles')).toBe('pokémon Lab|Nope');
    expect(calls[0]!.headers['User-Agent']).toBe(USER_AGENT);
  });

  it('batches at most 50 titles per request and throttles to one request per second', async () => {
    const titles = Array.from({ length: 60 }, (_, i) => `Page ${i}`);
    const respond = (url: URL) =>
      json({ query: { pages: url.searchParams.get('titles')!.split('|').map((t, i) => revision(t, i)) } });
    const { client, calls, sleeps } = setup([respond, respond]);
    const pages = await client.getPages(titles);
    expect(calls.map((c) => c.url.searchParams.get('titles')!.split('|').length)).toEqual([50, 10]);
    expect(pages.size).toBe(60);
    expect(sleeps).toEqual([1000]);
  });

  it('follows continuation when content is split across responses', async () => {
    const { client, calls } = setup([
      () =>
        json({
          continue: { rvcontinue: 'abc', continue: '||' },
          query: { pages: [revision('A', 1), { title: 'B' }] },
        }),
      () => json({ query: { pages: [{ title: 'A' }, revision('B', 2)] } }),
    ]);
    const pages = await client.getPages(['A', 'B']);
    expect(calls[1]!.url.searchParams.get('rvcontinue')).toBe('abc');
    expect(pages.get('A')?.revid).toBe(1);
    expect(pages.get('B')?.revid).toBe(2);
  });
});

describe('MediaWikiClient.request retries', () => {
  it('retries 5xx with exponential backoff and honors Retry-After', async () => {
    const { client, sleeps } = setup([
      () => new Response('', { status: 503 }),
      () => new Response('', { status: 429, headers: { 'retry-after': '7' } }),
      () => json({ query: { pages: [] } }),
    ]);
    await client.request({ action: 'query' });
    expect(sleeps).toEqual([1000, 7000]);
  });

  it('retries maxlag errors', async () => {
    const { client } = setup([
      () => json({ error: { code: 'maxlag', info: 'Waiting' } }, { headers: { 'retry-after': '1' } }),
      () => json({ ok: true }),
    ]);
    await expect(client.request({ action: 'query' })).resolves.toEqual({ ok: true });
  });

  it('fails on other API errors and after too many retries', async () => {
    const { client } = setup([() => json({ error: { code: 'badvalue', info: 'Bad' } })]);
    await expect(client.request({ action: 'query' })).rejects.toThrow(MediaWikiError);

    const failing = setup(Array.from({ length: 6 }, () => () => new Response('', { status: 500 })));
    await expect(failing.client.request({ action: 'query' })).rejects.toThrow(/after 6 attempts/);
  });
});

describe('MediaWikiClient files', () => {
  it('resolves image URLs and SHA-1s through normalization, with null for missing files', async () => {
    const { client, calls } = setup([
      () =>
        json({
          query: {
            normalized: [{ from: 'File:Spr_1b_001.png', to: 'File:Spr 1b 001.png' }],
            pages: [
              { title: 'File:Spr 1b 001.png', imageinfo: [{ url: 'https://a/Spr_1b_001.png', sha1: 'abc' }] },
              { title: 'File:Nope.png', missing: true },
            ],
          },
        }),
    ]);
    const infos = await client.getImageInfo(['File:Spr_1b_001.png', 'File:Nope.png']);
    expect(infos.get('File:Spr_1b_001.png')).toEqual({ url: 'https://a/Spr_1b_001.png', sha1: 'abc' });
    expect(infos.get('File:Nope.png')).toBeNull();
    expect(calls[0]!.url.searchParams.get('iiprop')).toBe('url|sha1');
  });

  it('downloads bytes with the User-Agent, throttling and retries', async () => {
    const { client, calls, sleeps } = setup([
      () => new Response('', { status: 503 }),
      () => new Response(new Uint8Array([1, 2, 3])),
    ]);
    await expect(client.download('https://a/Spr_1b_001.png')).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(calls).toHaveLength(2);
    expect(calls[1]!.headers['User-Agent']).toBe(USER_AGENT);
    expect(calls[1]!.url.searchParams.has('format')).toBe(false);
    expect(sleeps).toEqual([1000]);
  });
});

describe('wikiUrl', () => {
  it('builds article URLs', () => {
    expect(wikiUrl('Kanto Route 1')).toBe('https://bulbapedia.bulbagarden.net/wiki/Kanto_Route_1');
    expect(wikiUrl('Pokémon Mansion (Kanto)')).toBe(
      'https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Mansion_(Kanto)',
    );
  });
});
