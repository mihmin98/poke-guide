import { swipeDirection } from './swipe';

const at = (x: number, y: number, t: number) => ({ x, y, t });

describe('swipeDirection', () => {
  it('reads quick, mostly horizontal travel as a swipe', () => {
    expect(swipeDirection(at(300, 200, 0), at(200, 220, 200))).toBe('left');
    expect(swipeDirection(at(100, 200, 0), at(200, 190, 200))).toBe('right');
  });

  it('ignores short, slow or mostly vertical movement', () => {
    expect(swipeDirection(at(300, 200, 0), at(250, 200, 100)), 'short').toBeNull();
    expect(swipeDirection(at(300, 200, 0), at(100, 200, 900)), 'slow').toBeNull();
    expect(swipeDirection(at(300, 200, 0), at(200, 300, 200)), 'diagonal').toBeNull();
  });
});
