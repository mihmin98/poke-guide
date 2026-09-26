import { splitTooltips, stripMarkup } from './markup';

describe('stripMarkup', () => {
  it('strips line breaks, small tags and formatting', () => {
    expect(stripMarkup("Special<br><small>'''(Yellow)'''</small>")).toBe('Special (Yellow)');
  });

  it('renders links, including piped ones, and drops files', () => {
    expect(stripMarkup('[[Kanto Route 1|Route 1]] and [[Pewter City]][[File:X.png|20px]]')).toBe(
      'Route 1 and Pewter City',
    );
  });

  it('renders common templates', () => {
    expect(stripMarkup('{{tt|One|A note}}')).toBe('One');
    expect(stripMarkup('{{color2|000|Old Rod}}')).toBe('Old Rod');
    expect(stripMarkup('{{color2|000|Fishing|Fishing spots}}')).toBe('Fishing spots');
    expect(
      stripMarkup(
        '[[Pokémon Gold and Silver Versions|{{color|000|Pokémon {{color|DAA520|Gold}} and Silver}}]]',
      ),
    ).toBe('Pokémon Gold and Silver');
    expect(stripMarkup('Purchase for {{PDollar}}500')).toBe('Purchase for ₽500');
    expect(stripMarkup('{{rt|2|Kanto}}')).toBe('Route 2');
    expect(stripMarkup('{{p|Nidoran♀}}')).toBe('Nidoran♀');
    expect(stripMarkup('this {{ScPkmn}} and a {{ScBall}}')).toBe('this Pokémon and a Poké Ball');
    expect(stripMarkup('{{OBP|Pokémon|species|{{ScPkmn}}}} {{wp|Kappa (folklore)|Kappa}}')).toBe(
      'Pokémon Kappa',
    );
  });

  it('uses the display text of link templates and renders game names', () => {
    expect(
      stripMarkup('Prior to {{game|Yellow}}, no Pokémon appear while {{m|surf|surfing}} here.'),
    ).toBe('Prior to Pokémon Yellow, no Pokémon appear while surfing here.');
    expect(stripMarkup('while {{m|surf}}ing')).toBe('while surfing');
  });

  it('decodes entities and collapses whitespace', () => {
    expect(stripMarkup(' Farfetch&#39;d&nbsp;&amp;  Mr.&nbsp;Mime ')).toBe("Farfetch'd & Mr. Mime");
  });
});

describe('splitTooltips', () => {
  it('separates visible text from tooltip notes', () => {
    expect(splitTooltips("{{tt|One|If Pikachu's friendship is 147 or higher.}}")).toEqual({
      text: 'One',
      notes: ["If Pikachu's friendship is 147 or higher."],
    });
  });

  it('leaves other templates untouched', () => {
    expect(splitTooltips('Purchase for {{PDollar}}500')).toEqual({
      text: 'Purchase for {{PDollar}}500',
      notes: [],
    });
  });
});
