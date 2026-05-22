export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: { $type: string }[];
}

export interface ReplyRef {
  parent?: { uri: string };
  root?: { uri: string };
}

export interface AuthorLabel {
  val: string;
}

export interface ClassifyInput {
  text: string;
  facets?: Facet[];
  reply?: ReplyRef;
  authorDid: string;
  authorHandle: string;
  authorLabels?: AuthorLabel[];
}

export interface ClassifyResult {
  isUrlList: boolean;
  linkCount: number;
  coverage: number;
  reason?: string;
}

const MIN_LINKS = 4;
const MIN_CHAR_COVERAGE = 0.9;

const WHITESPACE_RE = /\s/;
const BOT_HANDLE_RE = /(^|[-.])bots?\d*([-.]|$)/i;
const BOT_LABEL_RE = /\bbot\b/i;

function parseDidFromAtUri(uri: string): string | null {
  const m = uri.match(/^at:\/\/([^/]+)\//);
  return m ? m[1] : null;
}

export function isBotAuthor(
  handle: string,
  labels: AuthorLabel[] | undefined,
): boolean {
  if (BOT_HANDLE_RE.test(handle?.toLowerCase() ?? "")) return true;
  if ((labels ?? []).some((l) => BOT_LABEL_RE.test(l.val))) return true;
  return false;
}

function isExternalLinkFacet(f: Facet): boolean {
  for (const x of f.features) {
    if (x.$type !== "app.bsky.richtext.facet#link") continue;
    const uri = (x as { uri?: string }).uri ?? "";
    // Internal bsky.app links (hashtags, profile links, embedded post links)
    // are not "external" link payloads — exclude them from URL-list scoring.
    try {
      const u = new URL(uri);
      if (u.hostname === "bsky.app" || u.hostname.endsWith(".bsky.app")) return false;
    } catch {
      return false;
    }
    return true;
  }
  return false;
}

export function classify(input: ClassifyInput): ClassifyResult {
  const { text, facets, reply, authorDid, authorHandle, authorLabels } = input;

  // (4) Skip bot accounts.
  if (isBotAuthor(authorHandle, authorLabels)) {
    return { isUrlList: false, linkCount: 0, coverage: 0, reason: "bot author" };
  }

  // (1) At least 4 EXTERNAL link facets (excludes bsky.app/hashtag etc).
  const linkFacets = (facets ?? []).filter(isExternalLinkFacet);
  if (linkFacets.length < MIN_LINKS) {
    return {
      isUrlList: false,
      linkCount: linkFacets.length,
      coverage: 0,
      reason: `only ${linkFacets.length} links`,
    };
  }

  // (2) Self-reply (parent post is by the same author).
  const parentUri = reply?.parent?.uri;
  if (!parentUri || parseDidFromAtUri(parentUri) !== authorDid) {
    return {
      isUrlList: false,
      linkCount: linkFacets.length,
      coverage: 0,
      reason: parentUri ? "reply to another author" : "not a reply",
    };
  }

  // (3) >=90% of non-whitespace CHARACTERS (as visible to a viewer) are inside
  //     link facets. Iterate codepoints, tracking byte position so we can index
  //     into the byte-level facet coverage map.
  const bytes = new TextEncoder().encode(text);
  const coveredBytes = new Uint8Array(bytes.length);
  for (const f of linkFacets) {
    const start = Math.max(0, f.index.byteStart);
    const end = Math.min(bytes.length, f.index.byteEnd);
    for (let i = start; i < end; i++) coveredBytes[i] = 1;
  }

  const encoder = new TextEncoder();
  let bytePos = 0;
  let charsTotal = 0;
  let charsCovered = 0;
  for (const ch of text) {
    const len = encoder.encode(ch).length;
    if (!WHITESPACE_RE.test(ch)) {
      charsTotal++;
      let covered = false;
      for (let i = bytePos; i < bytePos + len; i++) {
        if (coveredBytes[i]) {
          covered = true;
          break;
        }
      }
      if (covered) charsCovered++;
    }
    bytePos += len;
  }

  if (charsTotal === 0) {
    return {
      isUrlList: true,
      linkCount: linkFacets.length,
      coverage: 1,
    };
  }

  const coverage = charsCovered / charsTotal;
  return {
    isUrlList: coverage >= MIN_CHAR_COVERAGE,
    linkCount: linkFacets.length,
    coverage,
    reason: coverage >= MIN_CHAR_COVERAGE ? undefined : `coverage ${(coverage * 100).toFixed(0)}%`,
  };
}
