/**
 * Story battle teams (plan §7.14 "Battle teams", Phase 19). The walkthrough part pages the cross-checks already
 * fetch hold each important battle as a `{{Party}}` block: `{{Party | name | class | sprite | prize | location |
 * caption | pokemon=N }}`, then N `{{Pokémon}}` members, then `{{Party/end}}`.
 *
 * A curated milestone names its trainer (`trainer: 'Brock'`, or alternatives such as `['???', 'Silver']`). Per game
 * and part page it claims the first unclaimed battle whose party name matches, in page order, so names that repeat
 * in a part (the Radio Tower Executives) resolve by order. A battle is one party, or a run of consecutive parties
 * with the same name and location that each have a variant caption: one per starter (`{{PlayerChoice}}`) or, in
 * Yellow, per evolution of the rival's Eevee (`{{BlueEevee}}`). The page's `game` parameter is ignored: the config's
 * `walkthroughPages` says which games a page covers. Pure.
 */
import type {
  GameId,
  Milestone,
  Move,
  Species,
  TeamMember,
  TeamVariant,
  TrainerTeam,
} from '../../../src/app/core/domain/models';
import { stripMarkup } from './markup';
import type { NumberedMilestone } from './milestone-numbers';
import type { WalkthroughPartPage } from './milestones';
import { findTemplates, parseTemplate, stripComments } from './wikitext';

export interface PartyMember {
  dex: number;
  /** The page's species name, for the cross-check. */
  species: string;
  level: number;
  gender?: 'male' | 'female';
  /** The page's types, for the cross-check; ours are used in the app. */
  types: string[];
  moves: string[];
}

/** As on the page; `attachTeams` resolves the Eevee evolution's name to its dex. */
export type PartyVariant =
  { kind: 'starter'; dex: number } | { kind: 'rival-eevee'; species: string; evolved: boolean };

export interface Party {
  name: string;
  trainerClass?: string;
  prize?: number;
  location: string;
  variant?: PartyVariant;
  members: PartyMember[];
}

export interface ParsedParties {
  parties: Party[];
  problems: string[];
}

const PARTY_OPENING = /\{\{\s*Party\s*(?=[|}\n])/gi;
const PARTY_END = /\{\{\s*Party\/end\s*\}\}/gi;
const MEMBER_TEMPLATES = new Set(['pokémon', 'pokemon']);

function parseVariant(caption: string): PartyVariant | string | undefined {
  if (!caption) return undefined;
  const call = parseTemplate(caption);
  if (call?.name === 'playerchoice') {
    const dex = Number(call.positional[0]);
    if (Number.isInteger(dex) && dex > 0) return { kind: 'starter', dex };
  }
  if (call?.name === 'blueeevee' && call.positional[0])
    return {
      kind: 'rival-eevee',
      species: stripMarkup(call.positional[0]),
      evolved: call.named['evolved']?.toLowerCase() !== 'no',
    };
  return `unknown party caption "${caption}"`;
}

function parseMember(named: Record<string, string>): PartyMember | string {
  const species = stripMarkup(named['pokemon'] ?? '');
  const dex = Number(named['ndex']);
  const level = Number(named['level']);
  if (!Number.isInteger(dex) || dex < 1) return `${species || '?'} has no valid ndex`;
  if (!Number.isInteger(level)) return `${species} has no valid level`;
  const gender = named['gender']?.toLowerCase();
  // "both" (a Gen II species that can be either) tells nothing, like no gender at all.
  if (gender && gender !== 'male' && gender !== 'female' && gender !== 'both')
    return `${species} has an unknown gender "${named['gender']}"`;
  return {
    dex,
    species,
    level,
    ...(gender === 'male' || gender === 'female' ? { gender } : {}),
    types: [named['type1'], named['type2']].filter((t): t is string => !!t).map(stripMarkup),
    moves: [1, 2, 3, 4]
      .map((n) => stripMarkup(named[`move${n}`] ?? ''))
      .filter((m) => m && m !== '—' && m !== '-'),
  };
}

/** The page's `{{Party}}` blocks in page order. Gym parties sit inside a box, so they're found by their opening. */
export function parseParties(wikitext: string): ParsedParties {
  const text = stripComments(wikitext);
  const parties: Party[] = [];
  const problems: string[] = [];
  for (const match of text.matchAll(PARTY_OPENING)) {
    const block = findTemplates(text, match.index)[0];
    if (!block || block.start !== match.index) continue;
    const name = stripMarkup(block.named['name'] ?? '');
    const what = `Party "${name}"`;
    PARTY_END.lastIndex = block.end;
    const end = PARTY_END.exec(text);
    if (!name || !end) {
      problems.push(`${what} has ${name ? 'no {{Party/end}}' : 'no name'}`);
      continue;
    }
    const members: PartyMember[] = [];
    for (const call of findTemplates(text, block.end, end.index)) {
      if (!MEMBER_TEMPLATES.has(call.name)) continue;
      const member = parseMember(call.named);
      if (typeof member === 'string') problems.push(`${what}: ${member}`);
      else members.push(member);
    }
    const expected = Number(block.named['pokemon']);
    if (Number.isInteger(expected) && expected !== members.length)
      problems.push(`${what} says pokemon=${expected} but lists ${members.length}`);
    const variant = parseVariant(block.named['caption'] ?? '');
    if (typeof variant === 'string') problems.push(`${what}: ${variant}`);
    const trainerClass = stripMarkup(block.named['class'] ?? '');
    const prize = Number(stripMarkup(block.named['prize'] ?? '').replace(/[^\d]/g, ''));
    parties.push({
      name,
      // Proton's page says "Executive Executive"; a class that repeats the name tells nothing.
      ...(trainerClass && trainerClass !== name ? { trainerClass } : {}),
      ...(prize > 0 ? { prize } : {}),
      location: stripMarkup(block.named['location'] ?? ''),
      ...(variant && typeof variant !== 'string' ? { variant } : {}),
      members,
    });
  }
  return { parties, problems };
}

/** One battle: a party, or the run of its variants. */
export function battlesOf(parties: readonly Party[]): Party[][] {
  const battles: Party[][] = [];
  for (const party of parties) {
    const run = battles.at(-1);
    const last = run?.at(-1);
    if (
      run &&
      last?.variant &&
      party.variant?.kind === last.variant.kind &&
      party.name === last.name &&
      party.location === last.location
    )
      run.push(party);
    else battles.push([party]);
  }
  return battles;
}

export interface TeamContext {
  species: readonly Pick<Species, 'dex' | 'name' | 'types'>[];
  /** The version group's Pokédex moves: page move names must be in it. */
  moves: readonly Pick<Move, 'name' | 'type'>[];
}

export interface TeamIssue {
  level: 'error' | 'warning';
  page?: string;
  message: string;
}

/** A battle on a part page that no milestone claimed (plan §7.14); the report counts these. */
export interface UnclaimedBattle {
  game: GameId;
  part: number;
  page: string;
  name: string;
  location: string;
}

export interface AttachResult {
  /** The milestones without `trainer`, with `teams` where one was claimed. */
  milestones: Milestone[];
  issues: TeamIssue[];
  unclaimed: UnclaimedBattle[];
}

const BATTLE_KINDS: readonly Milestone['kind'][] = ['gym', 'battle'];

export function attachTeams(
  milestones: readonly NumberedMilestone[],
  pages: readonly WalkthroughPartPage[],
  context: TeamContext,
): AttachResult {
  const issues: TeamIssue[] = [];
  const seen = new Set<string>();
  const issue = (level: TeamIssue['level'], message: string, page?: string) => {
    if (seen.has(message)) return;
    seen.add(message);
    issues.push({ level, message, ...(page ? { page } : {}) });
  };
  const species = new Map(context.species.map((s) => [s.dex, s]));
  const dexByName = new Map(context.species.map((s) => [s.name.toLowerCase(), s.dex]));
  const moves = new Map(context.moves.map((m) => [m.name, m]));

  const parsed = new Map<string, Party[][]>();
  const battlesOn = (page: WalkthroughPartPage): Party[][] => {
    let battles = parsed.get(page.page);
    if (!battles) {
      const result = parseParties(page.wikitext);
      for (const problem of result.problems) issue('error', `${page.page}: ${problem}`, page.page);
      battles = battlesOf(result.parties);
      parsed.set(page.page, battles);
    }
    return battles;
  };
  const pageFor = new Map(pages.map((p) => [`${p.game}|${p.part}`, p]));
  const claimed = new Map<string, Set<number>>();

  const toTeam = (party: Party, page: string): TrainerTeam => {
    let variant: TeamVariant | undefined;
    if (party.variant?.kind === 'starter') variant = { ...party.variant };
    else if (party.variant) {
      const dex = dexByName.get(party.variant.species.toLowerCase());
      if (dex === undefined)
        issue('error', `Party "${party.name}": unknown species "${party.variant.species}"`, page);
      else variant = { kind: 'rival-eevee', dex, evolved: party.variant.evolved };
    }
    const pokemon = party.members.map((member): TeamMember => {
      const ours = species.get(member.dex);
      const what = `Party "${party.name}" on ${page}: ${member.species}`;
      if (!ours)
        issue('error', `${what} has #${member.dex}, which is not in the species list`, page);
      else {
        const types = member.types.map((t) => t.toLowerCase());
        if (types.join('/') !== ours.types.join('/'))
          issue(
            'warning',
            `${what} has types ${types.join('/')}, but ours are ${ours.types.join('/')}`,
            page,
          );
      }
      return {
        dex: member.dex,
        level: member.level,
        ...(member.gender ? { gender: member.gender } : {}),
        moves: member.moves.flatMap((name) => {
          const move = moves.get(name);
          if (!move) {
            issue('error', `${what} knows "${name}", which is not in the move list`, page);
            return [];
          }
          return [{ name, type: move.type }];
        }),
      };
    });
    return {
      trainer: party.name,
      ...(party.trainerClass ? { trainerClass: party.trainerClass } : {}),
      ...(party.prize !== undefined ? { prize: party.prize } : {}),
      ...(variant ? { variant } : {}),
      pokemon,
    };
  };

  const result = milestones.map(({ trainer, ...milestone }): Milestone => {
    if (trainer === undefined) return milestone;
    const what = `Milestone "${milestone.id}"`;
    if (!BATTLE_KINDS.includes(milestone.kind)) {
      issue('error', `${what} has a trainer, but only gym and battle milestones have teams`);
      return milestone;
    }
    const names = typeof trainer === 'string' ? [trainer] : [...trainer];
    const teams: Partial<Record<GameId, TrainerTeam[]>> = {};
    for (const [game, part] of Object.entries(milestone.part) as [GameId, number][]) {
      const page = pageFor.get(`${game}|${part}`);
      if (!page) {
        issue('error', `${what}: no walkthrough page for ${game} Part ${part} to find its team on`);
        continue;
      }
      const battles = battlesOn(page);
      const taken = claimed.get(`${game}|${part}`) ?? new Set<number>();
      claimed.set(`${game}|${part}`, taken);
      const index = battles.findIndex((b, i) => !taken.has(i) && names.includes(b[0]!.name));
      if (index === -1) {
        issue(
          'error',
          `${what}: ${game} Part ${part} has no unclaimed {{Party}} named ${names.map((n) => `"${n}"`).join(' or ')}`,
          page.page,
        );
        continue;
      }
      taken.add(index);
      teams[game] = battles[index]!.map((party) => toTeam(party, page.page));
    }
    return Object.keys(teams).length ? { ...milestone, teams } : milestone;
  });

  const unclaimed: UnclaimedBattle[] = [];
  for (const page of pages) {
    const taken = claimed.get(`${page.game}|${page.part}`);
    battlesOn(page).forEach((battle, i) => {
      if (taken?.has(i)) return;
      const { name, location } = battle[0]!;
      unclaimed.push({ game: page.game, part: page.part, page: page.page, name, location });
      issues.push({
        level: 'warning',
        page: page.page,
        message: `${page.game} Part ${page.part}: no milestone claims the {{Party}} "${name}" at ${location}`,
      });
    });
  }
  return { milestones: result, issues, unclaimed };
}
