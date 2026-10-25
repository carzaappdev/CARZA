// Turns free text from the search box ("2019 chevy silverado", "crv", "Model 3") into a make, model and
// model year from the catalog. Deliberately simple: whole-word matches, longest name wins, plus a few nicknames.

type Make = { id: number; name: string; slug: string };
type Model = { id: number; make_id: number; name: string; slug: string };

const MAKE_ALIASES: Record<string, string> = {
  chevy: 'chevrolet',
  vw: 'volkswagen',
  mercedes: 'mercedes-benz',
  benz: 'mercedes-benz',
  merc: 'mercedes-benz',
  landrover: 'land-rover',
  range: 'land-rover',
};

/** "F-150" → "f 150" */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function matches(query: string, tokens: Set<string>, name: string) {
  const n = normalize(name);
  // "f 150" matches "f-150" and "f 150"; "f150" (compact) matches a single token "f150".
  return n !== '' && (` ${query} `.includes(` ${n} `) || tokens.has(n.replace(/ /g, '')));
}

const longestFirst = <T extends { name: string }>(a: T, b: T) => b.name.length - a.name.length;

export function matchVehicleQuery(
  q: string,
  makes: readonly Make[],
  models: readonly Model[],
): { make?: Make; model?: Model; year?: number } {
  const query = normalize(q);
  if (!query) return {};
  const tokens = new Set(query.split(' '));
  const year = [...tokens].map(Number).find((n) => Number.isInteger(n) && n >= 1900 && n <= 2100);

  const aliased = [...tokens].map((t) => MAKE_ALIASES[t]).find(Boolean);
  const make =
    [...makes].sort(longestFirst).find((m) => matches(query, tokens, m.name)) ??
    makes.find((m) => m.slug === aliased);

  const candidates = make ? models.filter((m) => m.make_id === make.id) : models;
  const found = [...candidates].sort(longestFirst).filter((m) => matches(query, tokens, m.name));
  // Without a make, only accept a model name that belongs to exactly one make ("Camry", not "Escape"-like
  // clashes across makes).
  const model = make || new Set(found.map((m) => m.make_id)).size === 1 ? found[0] : undefined;

  return { make: make ?? makes.find((m) => m.id === model?.make_id), model, year };
}
