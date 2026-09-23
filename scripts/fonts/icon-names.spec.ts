import { collectIconNames } from './icon-names';

describe('collectIconNames', () => {
  it('reads static icons, quoted names in interpolations and icon properties', () => {
    const scan = collectIconNames([
      {
        path: 'a.ts',
        text: `
          <mat-icon aria-hidden="true">search</mat-icon>
          <mat-icon class="mark"
            >check_circle</mat-icon
          >
          <mat-icon>{{ open() ? 'expand_less' : 'expand_more' }}</mat-icon>
          <mat-icon>{{ item.icon }}</mat-icon>
        `,
      },
      { path: 'b.ts', text: `const items = [{ id: 'surf', icon: 'waves' }, { icon: 'search' }];` },
      { path: 'c.ts', text: `const fallback = kind ? KINDS[kind] : icon('help');` },
    ]);
    expect(scan.names).toEqual([
      'check_circle',
      'expand_less',
      'expand_more',
      'help',
      'search',
      'waves',
    ]);
    expect(scan.problems).toEqual([]);
  });

  it('reports icon bodies it cannot read', () => {
    const scan = collectIconNames([{ path: 'c.html', text: '<mat-icon>Check Me</mat-icon>' }]);
    expect(scan.problems).toEqual(['c.html: <mat-icon>Check Me</mat-icon>']);
  });
});
