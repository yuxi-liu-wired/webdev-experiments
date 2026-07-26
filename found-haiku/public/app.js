import { SyllableCounter } from './src/syllables.js';
import { findPoems, FORMS, parsePattern } from './src/finder.js';

const $ = (id) => document.getElementById(id);
const results = $('results');
const statusEl = $('status');
const bar = $('bar');
const barI = bar.querySelector('i');

let counter = null;
let cancelled = false;
let running = false;

function setStatus(msg, isErr) {
  statusEl.innerHTML = isErr ? `<span class="err">${esc(msg)}</span>` : msg;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const n = (x) => x.toLocaleString();

// --- dictionary ------------------------------------------------------------

async function dictionary() {
  if (counter) return counter;
  setStatus('loading the pronouncing dictionary…');
  const t0 = performance.now();
  counter = await SyllableCounter.load('./data/syllables.txt');
  setStatus(`dictionary ready — ${n(counter.size)} words in ${Math.round(performance.now() - t0)}ms`);
  return counter;
}

// --- form / options --------------------------------------------------------

function currentPattern() {
  const form = document.querySelector('input[name=form]:checked').value;
  if (form !== 'custom') return { pattern: FORMS[form].pattern, name: form };
  const pattern = parsePattern($('custom').value);
  if (!pattern) throw new Error('that custom form is not a list of syllable counts — try 5-7-5');
  const named = Object.entries(FORMS).find(([, f]) => f.pattern.join('-') === pattern.join('-'));
  return { pattern, name: named ? named[0] : pattern.join('-') };
}

function currentOptions() {
  const { pattern, name } = currentPattern();
  return {
    pattern,
    name,
    scope: document.querySelector('input[name=scope]:checked').value,
    alternates: $('alt').checked,
    dictOnly: $('strictwords').checked,
    limit: 400,
  };
}

// --- rendering -------------------------------------------------------------

function renderPoem(poem, text, options) {
  const li = document.createElement('li');

  const body = document.createElement('div');
  body.className = 'poem';
  for (const line of poem.lines) {
    const row = document.createElement('div');
    row.className = 'line';
    const words = document.createElement('span');
    let html = '';
    let cursor = line.words[0].start;
    for (const w of line.words) {
      html += esc(text.slice(cursor, w.start));
      const raw = esc(text.slice(w.start, w.end));
      html += w.source === 'dict' || w.source === 'number'
        ? raw
        : `<span class="guessed" title="not in the dictionary — ${w.counts[0]} syllable${w.counts[0] === 1 ? '' : 's'} is this engine's guess">${raw}</span>`;
      cursor = w.end;
    }
    words.innerHTML = html;
    const beat = document.createElement('span');
    beat.className = 'beat';
    beat.textContent = line.syllables;
    row.append(words, beat);
    body.append(row);
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  const shape = document.createElement('span');
  shape.textContent = options.pattern.join('-');
  meta.append(shape);
  if (poem.guessed) {
    const warn = document.createElement('span');
    warn.className = 'warn';
    warn.textContent = `${poem.guessed} guessed word${poem.guessed === 1 ? '' : 's'}`;
    meta.append(warn);
  }
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'copy';
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(poem.lines.map((l) => l.text).join('\n'));
    copy.textContent = 'copied';
    setTimeout(() => { copy.textContent = 'copy'; }, 1200);
  });
  const ctxBtn = document.createElement('button');
  ctxBtn.type = 'button';
  ctxBtn.textContent = 'in context';
  const ctx = document.createElement('div');
  ctx.className = 'context';
  ctxBtn.addEventListener('click', () => {
    if (!ctx.innerHTML) {
      const from = Math.max(0, poem.start - 220);
      const to = Math.min(text.length, poem.end + 220);
      ctx.innerHTML = `${from ? '…' : ''}${esc(text.slice(from, poem.start))}<mark>${esc(text.slice(poem.start, poem.end))}</mark>${esc(text.slice(poem.end, to))}${to < text.length ? '…' : ''}`;
    }
    ctx.classList.toggle('on');
  });
  meta.append(copy, ctxBtn);

  li.append(body, meta, ctx);
  results.append(li);
}

// --- sources ---------------------------------------------------------------

const BSKY_FEED = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';
let bskyReachable = true; // flipped once, so only the first page pays for a refusal

/**
 * One page of an account's posts.
 *
 * The deployed site calls Bluesky's public appview straight from the browser —
 * it answers with access-control-allow-origin: *, so no server is involved.
 * That request cannot leave the development container, whose firewall denies
 * bsky.app, so a refused connection falls back to the local /api/feed proxy in
 * serve.mjs. An HTTP error from Bluesky itself is reported rather than retried:
 * a misspelled handle is not a routing problem.
 */
async function feedPage(handle, cursor) {
  const qs = new URLSearchParams({ actor: handle, limit: '100', filter: 'posts_no_replies' });
  if (cursor) qs.set('cursor', cursor);

  let direct = null;
  if (bskyReachable) {
    try {
      direct = await fetch(`${BSKY_FEED}?${qs}`);
    } catch {
      bskyReachable = false; // no route to bsky.app from here
    }
  }
  if (direct) {
    const data = await direct.json().catch(() => ({}));
    if (direct.ok) return data;
    throw new Error(data.message || data.error || `bluesky answered ${direct.status}`);
  }

  const res = await fetch(`./api/feed?handle=${encodeURIComponent(handle)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `feed failed (${res.status})`);
  return data;
}

async function bskyText(handle) {
  setStatus(`fetching @${esc(handle)}’s posts…`);
  const posts = [];
  let cursor = '';
  for (let page = 0; page < 10 && !cancelled; page++) {
    const data = await feedPage(handle, cursor);
    for (const item of data.feed || []) {
      const text = item?.post?.record?.text;
      if (text && item.post?.author?.handle?.toLowerCase() === handle.toLowerCase()) posts.push(text);
    }
    setStatus(`fetching @${esc(handle)}’s posts… ${n(posts.length)} so far`);
    cursor = data.cursor || '';
    if (!cursor) break;
  }
  if (!posts.length) throw new Error(`no readable posts for @${handle}`);
  return posts.join('\n\n');
}

async function sourceText() {
  const src = document.querySelector('input[name=src]:checked').value;
  if (src === 'bsky') {
    const handle = $('handle').value.trim().replace(/^@/, '');
    if (!handle) throw new Error('give a handle first');
    return bskyText(handle);
  }
  const text = $('text').value;
  if (!text.trim()) throw new Error('paste some text first');
  return text;
}

// --- run -------------------------------------------------------------------

async function run(ev) {
  if (ev) ev.preventDefault();
  if (running) return;
  running = true;
  cancelled = false;
  results.innerHTML = '';
  $('empty').style.display = 'none';
  $('summary').style.display = 'none';
  bar.classList.remove('on');
  barI.style.width = '0';
  $('go').disabled = true;
  $('stop').style.display = 'inline-block';

  try {
    const options = currentOptions();
    const text = await sourceText();
    const c = await dictionary();
    if (cancelled) throw new DOMException('stopped', 'AbortError');

    setStatus(`reading ${n(text.length)} characters…`);
    bar.classList.add('on');
    await frame();

    const t0 = performance.now();
    const { poems, segments, words, capped } = findPoems(text, c, {
      ...options,
      onProgress: (done, total) => { barI.style.width = `${Math.round((100 * done) / total)}%`; },
    });
    barI.style.width = '100%';

    const shown = poems;
    $('s-words').textContent = n(words);
    $('s-segments').textContent = n(segments);
    $('s-found').textContent = n(shown.length);
    $('summary').style.display = 'flex';

    for (const poem of shown) renderPoem(poem, text, options);

    // haiku, tanka and tanaga take no English plural.
    const label = options.name === options.pattern.join('-')
      ? `${options.pattern.join('-')} poem${shown.length === 1 ? '' : 's'}`
      : options.name;
    const ms = Math.round(performance.now() - t0);
    if (!shown.length) {
      $('empty').textContent = `No ${label} in there. Longer text, a looser scope, or a shorter form will turn some up.`;
      $('empty').style.display = 'block';
    }
    setStatus(
      `read ${n(words)} words in ${n(segments)} clauses · ${n(shown.length)} ${label} found in ${ms}ms`
      + (options.dictOnly ? ' · dictionary words only' : '')
      + (capped ? ` · stopped at the first ${n(options.limit)}` : ''),
    );
  } catch (e) {
    if (e.name !== 'AbortError') setStatus(e.message || String(e), true);
    else setStatus('stopped.');
  } finally {
    running = false;
    $('go').disabled = false;
    $('stop').style.display = 'none';
  }
}

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

// --- wiring ----------------------------------------------------------------

$('f').addEventListener('submit', run);
$('stop').addEventListener('click', () => { cancelled = true; });

for (const el of document.querySelectorAll('input[name=src]')) {
  el.addEventListener('change', () => {
    const bsky = document.querySelector('input[name=src]:checked').value === 'bsky';
    $('text').style.display = bsky ? 'none' : 'block';
    $('handle').style.display = bsky ? 'block' : 'none';
    ($('handle').style.display === 'block' ? $('handle') : $('text')).focus();
  });
}

for (const el of document.querySelectorAll('input[name=form]')) {
  el.addEventListener('change', () => {
    $('custom').classList.toggle('on', el.value === 'custom' && el.checked);
  });
}

const textArea = $('text');
textArea.addEventListener('input', () => {
  const len = textArea.value.length;
  $('size').textContent = len ? `${n(len)} characters` : '';
});
textArea.addEventListener('dragover', (e) => { e.preventDefault(); textArea.classList.add('drop'); });
textArea.addEventListener('dragleave', () => textArea.classList.remove('drop'));
textArea.addEventListener('drop', async (e) => {
  e.preventDefault();
  textArea.classList.remove('drop');
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  textArea.value = await file.text();
  textArea.dispatchEvent(new Event('input'));
});

$('sample').addEventListener('click', async () => {
  $('src-text').checked = true;
  $('src-text').dispatchEvent(new Event('change'));
  const res = await fetch('./data/sample.txt');
  textArea.value = await res.text();
  textArea.dispatchEvent(new Event('input'));
  run();
});

// deep links: ?form=tanka&scope=cross&handle=alice.bsky.social
const q = new URLSearchParams(location.search);
if (q.get('form') && $(`fm-${q.get('form')}`)) {
  $(`fm-${q.get('form')}`).checked = true;
} else if (q.get('pattern')) {
  $('fm-custom').checked = true;
  $('custom').value = q.get('pattern');
  $('custom').classList.add('on');
}
if (q.get('scope') && $(`sc-${q.get('scope').slice(0, 5)}`)) {
  $(`sc-${q.get('scope').slice(0, 5)}`).checked = true;
}
if (q.get('handle')) {
  $('src-bsky').checked = true;
  $('src-bsky').dispatchEvent(new Event('change'));
  $('handle').value = q.get('handle');
  run();
}

dictionary().catch((e) => setStatus(e.message, true));
