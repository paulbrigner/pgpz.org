import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpdates, selectHomepageUpdates, renderHomepageUpdates, loadHomepageUpdates } from '../assets/js/policy-updates.mjs';

const update = (slug, category = 'weekly', publishedAt = '2026-10-05') => ({
  slug, category, categoryLabel: category === 'weekly' ? 'Weekly Policy Memo' : 'Special Update',
  title: `Policy analysis ${slug}`, shortTitle: `Analysis ${slug}`, publishedAt,
  displayDate: 'October 5, 2026', summary: `Published analysis for ${slug}.`,
  canonicalUrl: `https://pgpz.org/updates/${slug}`,
  pdfUrl: `https://pgpz.org/updates/${slug}/pdf`,
});

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.hidden = false;
    this.content = '';
  }
  set textContent(value) { this.content = value; this.children = []; }
  get textContent() { return this.content + this.children.map((node) => node.textContent).join(''); }
  set innerHTML(_) { throw new Error('Feed rendering must not insert HTML'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.content = ''; this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; delete this[key]; }
  querySelector(selector) { return selector === '[data-link-label]' ? this.label : null; }
}

function documentFixture() {
  const selectors = ['featured-date', 'featured-title', 'featured-summary', 'featured-link', 'latest-link', 'featured-pdf', 'policy-list', 'feed-status', 'feed-retry'];
  const nodes = new Map(selectors.map((name) => [`[data-${name}]`, new Element(name.includes('link') || name === 'featured-pdf' ? 'a' : 'div')]));
  for (const name of ['featured-link', 'latest-link']) {
    const node = nodes.get(`[data-${name}]`);
    node.label = new Element('span');
    node.append(node.label);
  }
  return {
    querySelector: (selector) => nodes.get(selector),
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => Object.assign(new Element('#text'), { textContent: text }),
  };
}

function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }

test('feature the latest weekly memo and a different weekly plus a Special Update', () => {
  const normalized = normalizeUpdates({ updates: [
    update('older-weekly', 'weekly', '2026-09-21'),
    update('recent-special', 'special', '2026-10-07'),
    update('latest-weekly', 'weekly', '2026-10-05'),
    update('previous-weekly', 'weekly', '2026-09-28'),
  ] });
  const selected = selectHomepageUpdates(normalized);
  assert.equal(selected.featured.slug, 'latest-weekly');
  assert.deepEqual(selected.rows.map((row) => row.slug), ['previous-weekly', 'recent-special']);
});

test('a small feed renders real entries without duplicating the featured memo', () => {
  assert.deepEqual(selectHomepageUpdates(normalizeUpdates({ updates: [update('one')] })).rows, []);
  const specials = selectHomepageUpdates(normalizeUpdates({ updates: [update('special', 'special')] }));
  assert.equal(specials.featured, null);
  assert.deepEqual(specials.rows.map((row) => row.slug), ['special']);
  assert.deepEqual(selectHomepageUpdates([]), { featured: null, rows: [] });
});

test('normalization rejects untrusted destinations, categories, duplicates, dates, and traversal', () => {
  const good = update('valid');
  const result = normalizeUpdates({ updates: [good, good,
    { ...update('external'), canonicalUrl: 'https://example.org/updates/external' },
    { ...update('script'), canonicalUrl: 'javascript:alert(1)' },
    { ...update('credentials'), canonicalUrl: 'https://someone@pgpz.org/updates/credentials' },
    { ...update('query'), canonicalUrl: '/updates/query?preview=true' },
    { ...update('bad-category'), category: '__proto__' },
    { ...update('bad-date'), publishedAt: 'not a date' },
    update('../private'), null,
  ] });
  assert.deepEqual(result.map((row) => row.slug), ['valid']);
  assert.equal(result[0].canonicalUrl, '/updates/valid');
  assert.equal(result[0].pdfUrl, '/updates/valid/pdf');
  assert.equal(normalizeUpdates({ updates: [{ ...good, pdfUrl: '/updates/another/pdf' }] })[0].pdfUrl, null);
  assert.equal(normalizeUpdates({ updates: [{ ...good, pdfUrl: 'https://community.pgpz.org/private.pdf' }] })[0].pdfUrl, null);
});

test('malformed nonempty feeds fail instead of pretending the archive is empty', () => {
  for (const payload of [null, {}, { updates: 'wrong' }, { updates: [{}] }]) {
    assert.throws(() => normalizeUpdates(payload));
  }
  assert.deepEqual(normalizeUpdates({ updates: [] }), []);
});

test('feed content is inserted as text and all detail/PDF links target public routes', () => {
  const document = documentFixture();
  const content = '<img src=x onerror=alert(1)>';
  renderHomepageUpdates(document, normalizeUpdates({ updates: [
    update('featured'), { ...update('special', 'special'), title: content, shortTitle: content, summary: content },
  ] }));
  assert.equal(document.querySelector('[data-featured-date]').hidden, false);
  assert.equal(document.querySelector('[data-latest-link]').href, '/updates/featured');
  const list = document.querySelector('[data-policy-list]');
  assert.equal(list.children.length, 1);
  assert.ok(list.textContent.includes(content));
  const nodes = descendants(list);
  assert.deepEqual(nodes.filter((node) => node.tagName === 'a').map((node) => node.href), ['/updates/special', '/updates/special/pdf']);
  assert.ok(nodes.filter((node) => node.tagName === 'img').every((node) => node.src.startsWith('/assets/icons/bootstrap/')));
});

test('missing PDFs stay hidden; an empty refresh clears prior featured links and rows', () => {
  const document = documentFixture();
  renderHomepageUpdates(document, normalizeUpdates({ updates: [update('featured'), update('old', 'weekly', '2026-09-28')] }));
  assert.equal(document.querySelector('[data-featured-pdf]').hidden, false);
  renderHomepageUpdates(document, normalizeUpdates({ updates: [{ ...update('new'), pdfUrl: null }] }));
  assert.equal(document.querySelector('[data-featured-pdf]').hidden, true);
  assert.equal(document.querySelector('[data-featured-pdf]').href, undefined);
  renderHomepageUpdates(document, []);
  assert.equal(document.querySelector('[data-featured-date]').hidden, true);
  assert.equal(document.querySelector('[data-latest-link]').href, '/updates');
  assert.equal(document.querySelector('[data-policy-list]').children.length, 0);
  assert.match(document.querySelector('[data-feed-status]').textContent, /when published/);
});

test('requests omit credentials and cache, then publish an accessible loaded state', async () => {
  const document = documentFixture();
  await loadHomepageUpdates(document, async (url, options) => {
    assert.equal(url, '/updates/feed.json');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(document.querySelector('[data-policy-list]').attributes['aria-busy'], 'true');
    return { ok: true, json: async () => ({ updates: [update('latest'), update('special', 'special')] }) };
  });
  assert.equal(document.querySelector('[data-policy-list]').attributes['aria-busy'], 'false');
  assert.equal(document.querySelector('[data-feed-status]').textContent, 'Latest policy updates loaded.');
  assert.equal(document.querySelector('[data-feed-retry]').hidden, true);
});

test('network, non-OK, and malformed feed failures offer retry without invented content', async () => {
  const failures = [
    async () => { throw new Error('offline'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({ wrong: [] }) }),
  ];
  for (const fetcher of failures) {
    const document = documentFixture();
    await loadHomepageUpdates(document, fetcher);
    assert.equal(document.querySelector('[data-policy-list]').children.length, 0);
    assert.equal(document.querySelector('[data-policy-list]').attributes['aria-busy'], 'false');
    assert.equal(document.querySelector('[data-feed-retry]').hidden, false);
    assert.match(document.querySelector('[data-feed-status]').textContent, /could not be loaded/);
  }
});
