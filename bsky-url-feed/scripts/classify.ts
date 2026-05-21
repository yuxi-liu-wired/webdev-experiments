export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: string }[];
}

export interface ClassifyInput {
  text: string;
  facets?: Facet[];
}

export interface ClassifyResult {
  isUrlList: boolean;
  linkCount: number;
  coverage: number;
}

const WHITESPACE_BYTES = new Set([0x09, 0x0a, 0x0d, 0x20]);
const MIN_LINKS = 2;
const MIN_COVERAGE = 0.7;

export function classify({ text, facets }: ClassifyInput): ClassifyResult {
  const linkFacets = (facets ?? []).filter((f) =>
    f.features.some((x) => x.$type === "app.bsky.richtext.facet#link"),
  );
  if (linkFacets.length < MIN_LINKS) {
    return { isUrlList: false, linkCount: linkFacets.length, coverage: 0 };
  }

  const bytes = new TextEncoder().encode(text);
  const covered = new Uint8Array(bytes.length);
  for (const f of linkFacets) {
    const start = Math.max(0, f.index.byteStart);
    const end = Math.min(bytes.length, f.index.byteEnd);
    for (let i = start; i < end; i++) covered[i] = 1;
  }

  let denom = 0;
  let num = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (WHITESPACE_BYTES.has(bytes[i])) continue;
    denom++;
    if (covered[i]) num++;
  }

  if (denom === 0) {
    return { isUrlList: true, linkCount: linkFacets.length, coverage: 1 };
  }
  const coverage = num / denom;
  return {
    isUrlList: coverage >= MIN_COVERAGE,
    linkCount: linkFacets.length,
    coverage,
  };
}
