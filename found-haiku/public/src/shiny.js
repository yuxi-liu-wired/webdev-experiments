// Shininess: how rare is this found haiku, empirically?
//
// The rarity table (data/rarity.json, built by tools/rarity-survey.mjs from a
// real firehose capture) counts how often each badge combination occurred.
// A find's rarity is posts-scanned over finds carrying at least its badges —
// "at least", so a poem with three badges counts the sightings of every
// superset too, and an unprecedented combination scores as rarer than
// anything in the table rather than dividing by zero.

export const TIERS = [
  [1e6, '🌟🌟🌟'],  // never seen in a million posts: the shiny
  [1e5, '🌟🌟'],
  [1e4, '🌟'],
  [1e3, '✨'],
  [0, ''],
];

function badgeSet(mask) {
  return mask === 'plain' ? [] : mask.split('+');
}

/** finds carrying at least these badges, per the table's mask counts. */
function supersetCount(table, wanted) {
  let n = 0;
  for (const [mask, count] of Object.entries(table.masks)) {
    const have = new Set(badgeSet(mask));
    if (wanted.every((b) => have.has(b))) n += count;
  }
  return n;
}

/**
 * { rarity, tier, badges } for a badge object from strict-lib's badges().
 * `u` is the poem's content-word uniqueness ratio: in log space it scales the
 * bits of rarity, so repetition spam pays for its badges proportionally —
 * rarity^u leaves an all-distinct poem untouched and collapses "Blood clot!"
 * nine times from six figures to single digits.
 */
export function shininess(table, badgeObj, u = 1) {
  const wanted = Object.entries(badgeObj).filter(([, v]) => v).map(([k]) => k);
  const count = supersetCount(table, wanted);
  // an unseen combination is at least rarer than one sighting would make it
  const raw = table.scanned / Math.max(count, 1) * (count ? 1 : 2);
  const rarity = Math.max(1, Math.round(raw ** u));
  const tier = TIERS.find(([floor]) => rarity >= floor)[1];
  return { rarity, tier, badges: wanted };
}

const PRETTY = {
  iambic: 'iambic', rhyme13: 'rhymed', rhymeAll: 'triple-rhymed', kigo: 'kigo',
  lipogramE: 'lipogram in e', alphabetical: 'alphabetical', monovocalic: 'monovocalic',
  stressPalindrome: 'stress-palindromic', isosyllabic: 'isosyllabic',
  sanmyaku: 'sanmyaku 山脈', stopless: 'stopword-free',
};

/** The flair line for the post: "🌟 1 in 240,000 · iambic, rhymed". */
export function flair(shine) {
  if (!shine.badges.length) return '';
  const names = shine.badges.map((b) => PRETTY[b] || b).join(', ');
  return `${shine.tier ? `${shine.tier} ` : ''}1 in ${shine.rarity.toLocaleString()} · ${names}`;
}

/** The rarest find of a batch, uniqueness-adjusted. */
export function pickRarest(table, finds) {
  let best = null;
  for (const f of finds) {
    const shine = shininess(table, f.badges, f.uniqueness ?? 1);
    if (!best || shine.rarity > best.shine.rarity) best = { ...f, shine };
  }
  return best;
}
