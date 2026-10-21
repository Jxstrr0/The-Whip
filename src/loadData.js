// Fetch every data/*.json file the game needs. Used by the game and by tests.html.
export const DATA_FILES = [
  'world', 'parties', 'party-names', 'names', 'ridings', 'cliques', 'backgrounds', 'tuning',
  'bill-templates', 'dialogue-lines', 'constituents', 'caucus', 'headlines', 'strings.en', 'career', 'scenarios', 'question-period', 'seasons', 'hill', 'cold-open', 'memoir',
];

export async function loadData(base = 'data/') {
  const entries = await Promise.all(
    DATA_FILES.map(async (name) => {
      const res = await fetch(`${base}${name}.json`);
      if (!res.ok) throw new Error(`Could not load ${name}.json (${res.status})`);
      return [name.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace('.en', ''), await res.json()];
    })
  );
  return Object.fromEntries(entries);
}
