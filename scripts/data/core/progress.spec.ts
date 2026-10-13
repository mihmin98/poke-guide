import { RequestProgress, formatDuration } from './progress';

function setup(isTTY: boolean) {
  let clock = 0;
  const out: string[] = [];
  const progress = new RequestProgress({
    stream: { isTTY, write: (text: string) => out.push(text) },
    now: () => clock,
    barWidth: 10,
  });
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
    clock += ms;
  };
  return {
    progress,
    out,
    sleeps,
    sleep,
    advance: (ms: number) => (clock += ms),
    /** What a terminal would show: the text after the last line clear. */
    screen: () => out.join('').split('\r\x1b[2K').at(-1)!,
  };
}

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(16_400)).toBe('16 s');
    expect(formatDuration(245_000)).toBe('4 min 05 s');
    expect(formatDuration(3_720_000)).toBe('1 h 02 min');
    expect(formatDuration(-5)).toBe('0 s');
  });
});

describe('RequestProgress', () => {
  it('assumes 3.5 s per request until one is measured, then uses the measured average', () => {
    const { progress, advance } = setup(false);
    progress.expect(4);
    expect(progress.etaMs()).toBe(14_000);
    advance(2000);
    progress.done();
    expect(progress.etaMs()).toBe(6000);
    advance(1000);
    expect(progress.etaMs()).toBe(5000);
  });

  it('lets the total grow, and never shows more done than expected', () => {
    const { progress, out } = setup(false);
    progress.expect(1);
    progress.done();
    progress.done();
    progress.expect(2);
    progress.done();
    expect(out).toEqual([
      'Bulbapedia [1/1 100%] · ETA ~0 s\n',
      'Bulbapedia [2/2 100%] · ETA ~0 s\n',
      'Bulbapedia [3/4 75%] · ETA ~0 s\n',
    ]);
  });

  it('draws a bar with a countdown on a terminal, and clears it when the response arrives', async () => {
    const { progress, screen, sleeps, sleep, advance } = setup(true);
    progress.expect(2);
    progress.sending();
    expect(screen()).toBe('Bulbapedia ▕░░░░░░░░░░▏ 0/2 0% · waiting for the response · ETA ~7 s');
    advance(1000);
    progress.done();
    expect(screen()).toBe('');

    await progress.wait(2500, sleep);
    expect(sleeps).toEqual([1000, 1000, 500]);
    expect(screen()).toBe('Bulbapedia ▕█████░░░░░▏ 1/2 50% · next request in 1 s · ETA ~0 s');
  });

  it('prints messages on their own line and redraws the bar', async () => {
    const { progress, out, screen, sleep } = setup(true);
    progress.expect(2);
    progress.sending();
    progress.print('HTTP 503; retrying');
    expect(out.join('')).toContain('\r\x1b[2KHTTP 503; retrying\n');
    expect(screen()).toMatch(/^Bulbapedia ▕/);
    progress.done();
    await progress.wait(0, sleep);
    expect(screen()).toBe('');
  });

  it('sleeps in one piece off a terminal and sums up at the end', async () => {
    const { progress, out, sleeps, sleep, advance } = setup(false);
    progress.finish();
    expect(out).toEqual([]);
    progress.expect(1);
    await progress.wait(3200, sleep);
    expect(sleeps).toEqual([3200]);
    advance(800);
    progress.done();
    progress.finish();
    expect(out.at(-1)).toBe('Bulbapedia: 1 request in 4 s\n');
  });
});
