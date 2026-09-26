/**
 * Assembles a version group's data files from fetched pages (plan §7.4–§7.12). Pure: pages in, data and
 * issues out. `build.ts` fetches the pages, prints the issues and writes the files.
 */
import type {
  GameId,
  GameLocation,
  LocationItem,
  Learnset,
  PokedexData,
  PokedexEntryText,
  SourceRef,
  Species,
  VersionGroupData,
} from '../../../src/app/core/domain/models';
import { POKEMON_TYPES } from '../../../src/app/core/games/pokemon-types';
import { GAMES, getVersionGroup } from '../../../src/app/core/games/registry';
import type { LocationConfig, VersionGroupConfig } from '../version-groups/types';
import type { CachedPage } from './cache';
import { CATCH_RATE_LIST_PAGE, parseCatchRateList, resolveCatchRates } from './catch-rate-history';
import {
  applyEncounterPatches,
  applyExclusiveGroups,
  checkEncounterRequirements,
  checkOverrideLocations,
  overrideRows,
} from './encounter-overrides';
import { walkEncounterSection, type WalkedRow, type WalkResult } from './encounter-walker';
import { diffEvolutionBoxes, type EvolutionBoxPage } from './evolution-boxes';
import {
  collectMoves,
  learnsetPageTitle,
  parseLearnsetPage,
  type ParsedLearnset,
} from './learnsets';
import {
  collectItemRows,
  walkItemSection,
  type ItemWalkOptions,
  type ItemWalkResult,
} from './items';
import { assignItemNumbers, type ItemNumberRegistry } from './item-numbers';
import {
  applyItemOverrides,
  checkItemRequirements,
  diffWalkthroughItems,
  type WalkthroughItems,
} from './location-items';
import { wikiUrl } from './mediawiki-client';
import { mergeRows } from './merge';
import { parsePrizeShops } from './shop';
import { diffTrades, parseTradeTables } from './trades';
import { slugify } from './slug';
import {
  NATIONAL_DEX_LIST_PAGE,
  parseNationalDexList,
  speciesInRange,
  type SpeciesListEntry,
} from './species-list';
import {
  baseExpIn,
  baseStatsIn,
  genderRatioFromCode,
  parseBaseStats,
  parseInfobox,
  parsePokedexEntries,
  pokedexEntriesForGames,
  speciesPageTitle,
  type InfoboxData,
} from './species-pages';
import { parseRegionalDexList } from './regional-dex';
import { typeExistsIn, typesInGeneration } from './type-history';

export interface BuildIssue {
  /** Errors fail the build; warnings are triaged in the report; notes are informational. */
  level: 'error' | 'warning' | 'note';
  page?: string;
  message: string;
}

/** A fetched page by requested title, or `null` when it doesn't exist or isn't available. */
export type PageLookup = (title: string) => CachedPage | null;

export interface AssembleOptions {
  builtAt: string;
  /** Members of `config.locationCategory`; `null` skips the category check (with a note). */
  categoryMembers: readonly string[] | null;
  /** The committed item number registry; `null` numbers every item from 1 (a new version group). */
  itemNumbers: ItemNumberRegistry | null;
}

export interface AssembleResult {
  data: VersionGroupData;
  pokedex: PokedexData;
  issues: BuildIssue[];
  /** The registry after this build, for `build.ts` to write back. */
  itemNumbers: ItemNumberRegistry;
}

// ---- page lists (the build fetches these in two rounds) ----

/** Pages needed before the species are known: the two species lists, every location page and walkthrough part. */
export function listPageTitles(config: VersionGroupConfig): string[] {
  return [
    NATIONAL_DEX_LIST_PAGE,
    CATCH_RATE_LIST_PAGE,
    ...config.locations.map((l) => l.page),
    ...walkthroughPartTitles(config).map((w) => w.page),
    ...(config.tradePage ? [config.tradePage.page] : []),
    ...(config.regionalDexPage ? [config.regionalDexPage] : []),
  ];
}

/** Walkthrough part pages per game (`Walkthrough:Pokémon Red and Blue/Part 3`), for the item cross-check. */
export function walkthroughPartTitles(
  config: VersionGroupConfig,
): { game: GameId; part: number; page: string }[] {
  return config.games.flatMap((game) => {
    const base = config.walkthroughPages[game];
    if (!base) return [];
    return (config.walkthroughs[game] ?? []).map(({ part }) => ({
      game,
      part,
      page: `${base}/Part ${part}`,
    }));
  });
}

export function speciesForConfig(
  nationalDexList: CachedPage,
  config: VersionGroupConfig,
): SpeciesListEntry[] {
  return speciesInRange(parseNationalDexList(nationalDexList.wikitext), config.speciesRange);
}

/** Species pages and this generation's learnset subpages. */
export function speciesPageTitles(
  config: VersionGroupConfig,
  species: readonly SpeciesListEntry[],
): string[] {
  return species.flatMap((s) => [
    speciesPageTitle(s.name),
    learnsetPageTitle(s.name, config.generation),
  ]);
}

// ---- helpers ----

/**
 * Placement per game: `order = part × 100 + index`, where `index` counts the game's earlier locations in the
 * same part (config list order is visit order). Throws when a part holds more than 100 locations.
 */
export function placeLocations(
  locations: readonly LocationConfig[],
  games: readonly GameId[],
): Map<string, GameLocation['placement']> {
  const placements = new Map<string, GameLocation['placement']>();
  const counts = new Map<string, number>();
  for (const location of locations) {
    const placement: GameLocation['placement'] = {};
    for (const game of games) {
      const entry = location.placement[game];
      if (!entry) continue;
      const key = `${game}|${entry.part}`;
      const index = counts.get(key) ?? 0;
      if (index >= 100)
        throw new Error(`Part ${entry.part} of ${game} has more than 100 locations`);
      counts.set(key, index + 1);
      placement[game] = { part: entry.part, order: entry.part * 100 + index };
    }
    placements.set(location.id, placement);
  }
  return placements;
}

/** Warnings for category pages missing from the config, and configured or ignored pages no longer in the category. */
export function diffLocationCategory(
  members: readonly string[],
  config: VersionGroupConfig,
): BuildIssue[] {
  const issues: BuildIssue[] = [];
  const inCategory = new Set(members);
  const configured = new Set(config.locations.map((l) => l.page));
  const ignored = new Set(config.ignoredCategoryPages);
  const category = config.locationCategory;
  for (const member of members) {
    if (!configured.has(member) && !ignored.has(member)) {
      issues.push({
        level: 'warning',
        message: `"${member}" is in ${category} but not in the location config`,
      });
    }
  }
  for (const page of configured) {
    if (!inCategory.has(page))
      issues.push({ level: 'warning', message: `Location "${page}" is not in ${category}` });
  }
  for (const page of ignored) {
    if (!inCategory.has(page)) {
      issues.push({
        level: 'warning',
        message: `Ignored page "${page}" is no longer in ${category}`,
      });
    }
  }
  return issues;
}

const byTitle = (sources: Map<string, SourceRef>) =>
  [...sources.values()].sort((a, b) => a.title.localeCompare(b.title));

/** Moves item rows matched by `config.itemNoteRules` (recurring Berry trees) into the location's notes. */
export function splitItemNotes(
  items: readonly LocationItem[],
  notes: readonly string[],
  config: Pick<VersionGroupConfig, 'itemNoteRules'>,
): Pick<GameLocation, 'items' | 'itemNotes'> {
  const rules = config.itemNoteRules ?? [];
  const kept: LocationItem[] = [];
  const itemNotes = [...notes];
  for (const item of items) {
    const rule = rules.find((r) => r.match.test(item.name) || r.match.test(item.where));
    if (!rule) {
      kept.push(item);
      continue;
    }
    const note = rule.note(item.name, item.where);
    if (!itemNotes.includes(note)) itemNotes.push(note);
  }
  return { items: kept, itemNotes };
}

/**
 * Adds each location's entry requirements (`LocationConfig.requires`) to its items, in place. Encounters get them
 * while the rows are collected.
 */
export function addLocationRequirements(
  locations: readonly GameLocation[],
  configs: readonly Pick<LocationConfig, 'id' | 'requires'>[],
): void {
  for (const config of configs) {
    if (!config.requires) continue;
    for (const item of locations.find((l) => l.id === config.id)?.items ?? []) {
      const stated = item.requires ?? [];
      const added = config.requires
        .filter((id) => !stated.some((group) => group.length === 1 && group[0] === id))
        .map((id) => [id]);
      if (added.length > 0) item.requires = [...added, ...stated];
    }
  }
}

// ---- assembly ----

export function assembleVersionGroup(
  config: VersionGroupConfig,
  getPage: PageLookup,
  options: AssembleOptions,
): AssembleResult {
  const issues: BuildIssue[] = [];
  const issue = (level: BuildIssue['level'], message: string, page?: string) =>
    issues.push({ level, message, ...(page ? { page } : {}) });
  const generation = config.generation;
  const group = getVersionGroup(config.id);
  const gameDefs = GAMES.filter((g) => config.games.includes(g.id));
  const mainSources = new Map<string, SourceRef>();
  const pokedexSources = new Map<string, SourceRef>();

  /** `genderRatio` from the infobox code; an unknown code is an error. */
  const genderOf = (info: InfoboxData, title: string): Pick<Species, 'genderRatio'> => {
    if (info.genderCode === null) return {};
    const ratio = genderRatioFromCode(info.genderCode);
    if (ratio === undefined) {
      issue('error', `Unknown gendercode ${info.genderCode}`, title);
      return {};
    }
    return { genderRatio: ratio };
  };

  /** Looks a page up and records it as a source; a missing page is an error. */
  const use = (title: string, ...sources: Map<string, SourceRef>[]): CachedPage | null => {
    const page = getPage(title);
    if (!page) {
      issue(
        'error',
        'Page is not available (missing on Bulbapedia, or not cached in offline mode)',
        title,
      );
      return null;
    }
    const ref = { title: page.resolvedTitle, revid: page.revid, url: wikiUrl(page.resolvedTitle) };
    for (const map of sources) map.set(ref.title, ref);
    return page;
  };
  const required = (title: string, ...sources: Map<string, SourceRef>[]): CachedPage => {
    const page = use(title, ...sources);
    if (!page) throw new Error(`Required page "${title}" is not available`);
    return page;
  };

  // Species master data and catch rates.
  const list = speciesForConfig(required(NATIONAL_DEX_LIST_PAGE, mainSources), config);
  const listByDex = new Map(list.map((e) => [e.dex, e]));
  const catchRateRows = parseCatchRateList(required(CATCH_RATE_LIST_PAGE, mainSources).wikitext);
  const catchRates = resolveCatchRates(catchRateRows, {
    generation,
    games: config.games,
    speciesRange: config.speciesRange,
    classifications: config.overrides.catchRateNotes,
  });
  for (const message of catchRates.errors) issue('error', message, CATCH_RATE_LIST_PAGE);

  // Regional Pokédex numbers, for the games whose registry entry has a regional Pokédex.
  const regionalGames = gameDefs.filter((g) => g.regionalDex).map((g) => g.id);
  const regionalPage = config.regionalDexPage ? use(config.regionalDexPage, mainSources) : null;
  const regionalNumbers = regionalPage ? parseRegionalDexList(regionalPage.wikitext) : null;
  const regionalDexOf = (dex: number): Pick<Species, 'regionalDex'> => {
    const no = regionalNumbers?.get(dex);
    if (!regionalGames.length || no === undefined) return {};
    return { regionalDex: Object.fromEntries(regionalGames.map((g) => [g, no])) };
  };
  if (regionalNumbers) {
    for (const entry of list) {
      if (!regionalNumbers.has(entry.dex))
        issue(
          'warning',
          `#${entry.dex} ${entry.name} has no regional Pokédex number`,
          regionalPage!.title,
        );
    }
  }

  const species: Species[] = [];
  const entries: Record<string, PokedexEntryText[]> = {};
  const evolutionPages: EvolutionBoxPage[] = [];
  const parsedLearnsets: [number, ParsedLearnset][] = [];

  for (const entry of list) {
    const title = speciesPageTitle(entry.name);
    const page = use(title, mainSources, pokedexSources);
    if (page) {
      try {
        const info = parseInfobox(page.wikitext);
        if (info.dex !== entry.dex)
          issue('error', `Infobox is #${info.dex}, the species list says #${entry.dex}`, title);
        const listRow = catchRateRows.find((r) => r.dex === entry.dex && r.form === null);
        if (listRow && listRow.catchRate !== info.catchRate) {
          issue(
            'error',
            `Catch-rate list has ${listRow.catchRate}, the infobox has ${info.catchRate}`,
            title,
          );
        }
        const types = typesInGeneration(entry.dex, entry.types, generation);
        for (const type of types) {
          if (!typeExistsIn(type, generation))
            issue('error', `Type ${type} doesn't exist in generation ${generation}`, title);
        }
        const rate = catchRates.rates.get(entry.dex);
        if (rate) {
          species.push({
            dex: entry.dex,
            name: entry.name,
            slug: entry.slug,
            types: types as Species['types'],
            ...regionalDexOf(entry.dex),
            catchRate: rate.catchRate,
            ...(rate.catchRateByGame ? { catchRateByGame: rate.catchRateByGame } : {}),
            ...(rate.note ? { catchRateNote: rate.note } : {}),
            baseStats: baseStatsIn(parseBaseStats(page.wikitext, entry.name), generation),
            category: info.category,
            heightM: info.heightM,
            weightKg: info.weightKg,
            baseExp: baseExpIn(info, generation),
            growthRate: info.growthRate,
            // Effort values exist from Generation III; earlier stat experience is a mechanics rule.
            ...(generation >= 3 ? { evYield: info.evYield } : {}),
            ...(group.features.breeding
              ? { eggGroups: info.eggGroups, ...genderOf(info, page.title) }
              : {}),
          });
        }
        const dexEntries = pokedexEntriesForGames(
          parsePokedexEntries(page.wikitext, generation),
          gameDefs,
        );
        for (const game of config.games) {
          if (!dexEntries.some((e) => e.games.includes(game)))
            issue('warning', `No Pokédex entry for ${game}`, title);
        }
        entries[String(entry.dex)] = dexEntries;
        evolutionPages.push({ dex: entry.dex, name: entry.name, wikitext: page.wikitext });
      } catch (error) {
        issue('error', error instanceof Error ? error.message : String(error), title);
      }
    }

    const learnsetTitle = learnsetPageTitle(entry.name, generation);
    const learnsetPage = use(learnsetTitle, pokedexSources);
    if (learnsetPage) {
      const parsed = parseLearnsetPage(learnsetPage.wikitext, {
        generation,
        games: config.games,
        levelColumns: config.learnsetLevelColumns,
        eggMoves: group.features.breeding,
        ...(config.learnsetTutorColumns ? { tutorColumns: config.learnsetTutorColumns } : {}),
      });
      for (const message of parsed.issues) issue('error', message, learnsetTitle);
      parsedLearnsets.push([entry.dex, parsed]);
    }
  }

  // Moves and learnsets.
  const collected = collectMoves(parsedLearnsets.map(([, parsed]) => parsed));
  for (const message of collected.issues) issue('error', message);
  const learnsets: Record<string, Learnset> = {};
  for (const [dex, parsed] of parsedLearnsets) {
    learnsets[String(dex)] = {
      levelUp: parsed.levelUp.map((row) => ({ move: slugify(row.move), levels: row.levels })),
      machines: [...new Set(parsed.machines.map((m) => slugify(m.move)))],
      prevo: parsed.prevo.map((row) => ({ ...row, move: slugify(row.move) })),
      ...(parsed.egg.length ? { egg: parsed.egg.map((move) => slugify(move)) } : {}),
      ...(parsed.tutor.length
        ? { tutor: parsed.tutor.map((row) => ({ ...row, move: slugify(row.move) })) }
        : {}),
    };
  }

  // Evolutions: the override is authoritative; the boxes only produce warnings.
  const [minDex, maxDex] = config.speciesRange;
  const evolutions = config.overrides.evolutions.map((edge) => ({ ...edge }));
  for (const edge of evolutions) {
    if (!listByDex.has(edge.from) || !listByDex.has(edge.to)) {
      issue(
        'error',
        `Evolution override #${edge.from} → #${edge.to} is outside #${minDex}–#${maxDex}`,
      );
    }
  }
  const evolutionDiff = diffEvolutionBoxes(
    evolutionPages,
    config.overrides.evolutions,
    config.speciesRange,
  );
  for (const message of evolutionDiff.warnings) issue('warning', message);
  for (const message of evolutionDiff.notes) issue('note', message);

  // Locations.
  const itemOptions = (pageTitle: string): ItemWalkOptions => ({
    pageTitle,
    games: config.games,
    gameFlags: config.itemGameFlags,
    aliases: config.itemAliases,
    requirementPhrases: config.overrides.items.requirementPhrases,
  });
  const ids = new Set<string>();
  for (const location of config.locations) {
    if (ids.has(location.id)) issue('error', `Duplicate location id "${location.id}"`);
    ids.add(location.id);
  }
  const sourceOf = (title: string) => {
    const page = use(title, mainSources);
    return page ? { title: page.resolvedTitle, revid: page.revid } : null;
  };
  const encounterOverrides = config.overrides.encounters;
  for (const message of checkOverrideLocations(encounterOverrides, ids)) issue('error', message);
  const placements = placeLocations(config.locations, config.games);
  const locations: GameLocation[] = [];
  for (const location of config.locations) {
    const page = use(location.page, mainSources);
    if (!page) continue;
    const walk: WalkResult = location.itemsOnly
      ? { found: true, rows: [], notes: [], issues: [] }
      : walkEncounterSection(page.wikitext, {
          pageTitle: location.page,
          generationHeading: config.generationHeading,
          locationKind: location.kind,
          adapters: config.catchAdapters,
        });
    for (const found of walk.issues) issue(found.level, found.message, found.page);
    const itemWalk = walkItemSection(page.wikitext, itemOptions(location.page));
    for (const found of itemWalk.issues) issue(found.level, found.message, found.page);
    if (location.itemsOnly && !itemWalk.found)
      issue('error', 'No "Items" section on an items-only location', location.page);
    const shopConfig = config.prizeShops?.find((s) => s.locationId === location.id);
    const shop = shopConfig
      ? parsePrizeShops(page.wikitext, {
          pageTitle: location.page,
          games: config.games,
          ...shopConfig,
        })
      : null;
    if (shop) {
      for (const found of shop.issues) issue(found.level, found.message, found.page);
      for (const note of shop.notes) issue('note', note, location.page);
      if (!shop.found)
        issue('error', 'No prize shop section on a configured prize shop', location.page);
    }
    if (!walk.found && !shop?.found && !location.expectEmpty) {
      issue('warning', `No "Pokémon → ${config.generationHeading}" section`, location.page);
    }
    if (location.expectEmpty && walk.rows.length > 0) {
      issue(
        'error',
        `${walk.rows.length} encounter row(s) on a page marked expectEmpty`,
        location.page,
      );
    }
    const rows: WalkedRow[] = [];
    const patched = applyEncounterPatches(
      location.id,
      location.page,
      [
        ...walk.rows,
        ...(shop?.rows ?? []),
        ...overrideRows(location.id, location.page, encounterOverrides, sourceOf),
      ],
      encounterOverrides,
      sourceOf,
    );
    for (const message of patched.errors) issue('error', message, location.page);
    for (const walked of patched.rows) {
      const { row } = walked;
      const known = listByDex.get(row.dex);
      if (!known) {
        issue('error', `#${row.dex} ${row.name} is outside #${minDex}–#${maxDex}`, location.page);
        continue;
      }
      if (slugify(row.name) !== known.slug) {
        issue(
          'error',
          `Row name "${row.name}" doesn't match #${row.dex} ${known.name}`,
          location.page,
        );
      }
      // Species types come from the species list and type history; table types are only a cross-check, and some
      // rows swap the order (Cerulean Cave Rhyhorn "Rock/Ground") or drop a type (Vermilion City Tentacool).
      const expected = typesInGeneration(row.dex, known.types, generation);
      if (
        row.types.length > 0 &&
        [...row.types].sort().join('/') !== [...expected].sort().join('/')
      ) {
        issue(
          'warning',
          `${known.name} has types ${row.types.join('/')} here, expected ${expected.join('/')}`,
          location.page,
        );
      }
      if (row.trade && !listByDex.has(row.trade.giveDex)) {
        issue(
          'error',
          `${known.name} trade asks for #${row.trade.giveDex}, outside #${minDex}–#${maxDex}`,
          location.page,
        );
        continue;
      }
      rows.push(
        location.requires
          ? { ...walked, requires: [...new Set([...location.requires, ...walked.requires])] }
          : walked,
      );
    }
    locations.push({
      id: location.id,
      name: location.name,
      region: location.region,
      kind: location.kind,
      placement: placements.get(location.id) ?? {},
      source: { title: page.resolvedTitle, revid: page.revid },
      notes: walk.notes,
      subAreas: mergeRows(rows, config.games),
      ...splitItemNotes([...itemWalk.items, ...(shop?.items ?? [])], itemWalk.notes, config),
    });
  }

  // In-game trades: the trade page is diffed against the location tables and adds nicknames (plan §7.7).
  if (config.tradePage) {
    const page = use(config.tradePage.page, mainSources);
    if (page) {
      const parsed = parseTradeTables(page.wikitext, {
        pageTitle: config.tradePage.page,
        generationHeading: config.generationHeading,
        tables: config.tradePage.tables,
      });
      for (const found of parsed.issues) issue(found.level, found.message, found.page);
      const idByPage = new Map(config.locations.map((l) => [l.page, l.id]));
      const diff = diffTrades(locations, parsed.trades, idByPage);
      for (const message of diff.errors) issue('error', message, config.tradePage.page);
      for (const message of diff.warnings) issue('warning', message, config.tradePage.page);
    }
  }

  // Encounter overrides after the merge: exclusive groups and requirements (plan §7.7).
  for (const message of applyExclusiveGroups(locations, encounterOverrides.exclusiveGroups))
    issue('error', message);
  for (const message of checkEncounterRequirements(locations, config.overrides.unlocks))
    issue('error', message);

  // Items: overrides, prerequisites against unlocks, and the walkthrough cross-check (plan §7.13).
  for (const message of applyItemOverrides(locations, config.overrides.items, sourceOf))
    issue('error', message);
  addLocationRequirements(locations, config.locations);
  for (const message of checkItemRequirements(locations, config.overrides.unlocks))
    issue('error', message);
  const numbered = assignItemNumbers(
    locations,
    options.itemNumbers,
    config.overrides.items.retiredItems ?? [],
    config.id,
  );
  for (const message of numbered.errors) issue('error', message);
  for (const message of numbered.warnings) issue('warning', message);
  for (const message of numbered.notes) issue('note', message);
  const walkthroughRows = new Map<string, ItemWalkResult | null>();
  const walkthroughItems: WalkthroughItems[] = [];
  for (const { game, part, page: title } of walkthroughPartTitles(config)) {
    if (!walkthroughRows.has(title)) {
      const page = use(title, mainSources);
      const rows = page ? collectItemRows(page.wikitext, itemOptions(title)) : null;
      for (const found of rows?.issues ?? []) issue(found.level, found.message, found.page);
      walkthroughRows.set(title, rows);
    }
    const rows = walkthroughRows.get(title);
    if (!rows) continue;
    const fix = config.overrides.items.walkthroughGames?.find((f) => f.page === title);
    const items = fix ? rows.items.map((i) => ({ ...i, games: [...fix.games] })) : rows.items;
    walkthroughItems.push({ page: title, part, game, items });
  }
  for (const fix of config.overrides.items.walkthroughGames ?? []) {
    if (!walkthroughRows.has(fix.page))
      issue('error', `Walkthrough games fix names unknown page "${fix.page}"`);
  }
  const accepted = config.overrides.items.walkthroughAccepted;
  for (const { page, message } of diffWalkthroughItems(locations, walkthroughItems, accepted))
    issue('warning', message, page);

  if (options.categoryMembers)
    issues.push(...diffLocationCategory(options.categoryMembers, config));
  else issue('note', `Location category check skipped (${config.locationCategory} not available)`);
  const breeding = config.overrides.breeding ?? null;
  if (group.features.breeding && !breeding)
    issue('warning', 'Breeding rules are not configured yet; breeding is left out');
  for (const id of breeding?.dayCareLocationIds ?? []) {
    if (!locations.some((l) => l.id === id))
      issue('error', `Day Care location "${id}" is not configured`);
  }

  const data: VersionGroupData = {
    schemaVersion: 1,
    versionGroupId: config.id,
    generation,
    games: [...config.games],
    builtAt: options.builtAt,
    types: POKEMON_TYPES.map((t) => t.id).filter((type) => typeExistsIn(type, generation)),
    species,
    evolutions,
    breeding: breeding
      ? {
          dayCareLocationIds: [...breeding.dayCareLocationIds],
          dittoDex: breeding.dittoDex,
          ...(breeding.babyItemRequirements
            ? { babyItemRequirements: breeding.babyItemRequirements.map((r) => ({ ...r })) }
            : {}),
        }
      : null,
    walkthroughs: config.walkthroughs,
    unlocks: Object.fromEntries(
      Object.entries(config.overrides.unlocks).map(([game, list]) => [game, [...(list ?? [])]]),
    ),
    exclusiveGroups: encounterOverrides.exclusiveGroups.map(({ id, label, games, members }) => ({
      id,
      label,
      games: [...games],
      members: [...members],
    })),
    eventOnly: [...encounterOverrides.eventOnly],
    ...(encounterOverrides.requiresOtherGame?.length
      ? {
          requiresOtherGame: encounterOverrides.requiresOtherGame.map((r) => ({
            dex: [...r.dex],
            detail: r.detail,
          })),
        }
      : {}),
    locations,
    sources: byTitle(mainSources),
  };
  const pokedex: PokedexData = {
    schemaVersion: 1,
    versionGroupId: config.id,
    builtAt: options.builtAt,
    moves: collected.moves,
    learnsets,
    entries,
    sources: byTitle(pokedexSources),
  };
  return { data, pokedex, issues, itemNumbers: numbered.registry };
}
