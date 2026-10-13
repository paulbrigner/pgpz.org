const PUBLIC_ORIGIN = 'https://pgpz.org';
const CATEGORY_LABELS = { weekly: 'Weekly Policy Memo', special: 'Special Update' };
const ICON_ROOT = '/assets/icons/bootstrap/';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function publicUpdatePath(value, slug, { detail = false } = {}) {
  if (typeof value !== 'string' || !value || /[\\\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, PUBLIC_ORIGIN);
    const base = `/updates/${slug}`;
    if (url.origin !== PUBLIC_ORIGIN || url.username || url.password || url.search || url.hash) return null;
    if (detail ? ![base, `${base}/`].includes(url.pathname) : !url.pathname.startsWith(`${base}/`)) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

export function normalizeUpdates(payload) {
  if (!payload || !Array.isArray(payload.updates)) throw new Error('Invalid policy update feed');
  const seen = new Set();
  const updates = [];
  for (const item of payload.updates) {
    if (!item || typeof item !== 'object') continue;
    const slug = text(item.slug);
    const category = item.category;
    const title = text(item.title);
    const publishedAt = text(item.publishedAt);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(slug) || seen.has(slug) || !['weekly', 'special'].includes(category)) continue;
    if (!title || !publishedAt || !Number.isFinite(Date.parse(publishedAt))) continue;
    const canonicalUrl = publicUpdatePath(item.canonicalUrl, slug, { detail: true });
    if (!canonicalUrl) continue;
    seen.add(slug);
    updates.push({
      slug,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      title,
      shortTitle: text(item.shortTitle) || title,
      publishedAt,
      displayDate: text(item.displayDate) || new Intl.DateTimeFormat('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
      }).format(new Date(publishedAt)),
      summary: text(item.summary),
      canonicalUrl,
      pdfUrl: publicUpdatePath(item.pdfUrl, slug),
    });
  }
  if (payload.updates.length && !updates.length) throw new Error('Policy update feed contains no valid entries');
  return updates.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.slug.localeCompare(b.slug));
}

export function selectHomepageUpdates(updates) {
  const featured = updates.find((update) => update.category === 'weekly') || null;
  const remaining = updates.filter((update) => update.slug !== featured?.slug);
  const rows = [
    remaining.find((update) => update.category === 'weekly'),
    remaining.find((update) => update.category === 'special'),
  ].filter(Boolean);
  for (const update of remaining) {
    if (rows.length >= 2) break;
    if (!rows.some((row) => row.slug === update.slug)) rows.push(update);
  }
  return { featured, rows };
}

function excerpt(value, maximum) {
  if (value.length <= maximum) return value;
  const prefix = value.slice(0, maximum - 1);
  const lastSpace = prefix.lastIndexOf(' ');
  return `${prefix.slice(0, lastSpace > maximum / 2 ? lastSpace : undefined).trimEnd()}…`;
}

function element(document, tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function icon(document, name, className = 'icon') {
  const image = element(document, 'img', className);
  image.src = `${ICON_ROOT}${name}.svg`;
  image.alt = '';
  image.width = className === 'policy-row__icon' ? 76 : 20;
  image.height = image.width;
  return image;
}

function setLink(link, href, label, accessibleLabel) {
  link.href = href;
  link.querySelector('[data-link-label]').textContent = label;
  link.setAttribute('aria-label', accessibleLabel);
}

function updateLink(document, update) {
  const label = update.category === 'weekly' ? 'Read the memo' : 'Read the update';
  const link = element(document, 'a', 'text-link', label);
  link.href = update.canonicalUrl;
  link.setAttribute('aria-label', `${label}: ${update.title}`);
  link.append(icon(document, 'arrow-right'));
  return link;
}

function pdfLink(document, update) {
  const link = element(document, 'a', 'pdf-link');
  link.href = update.pdfUrl;
  link.setAttribute('aria-label', `Download PDF: ${update.title}`);
  link.append(icon(document, 'file-earmark-text'), document.createTextNode('Download PDF'));
  return link;
}

function resetFeatured(document) {
  const date = document.querySelector('[data-featured-date]');
  date.textContent = '';
  date.hidden = true;
  document.querySelector('[data-featured-title]').textContent = 'Weekly Policy Memo';
  document.querySelector('[data-featured-summary]').textContent = 'Clear analysis of the policy developments that matter for Zcash and financial privacy. Read our weekly memos and Special Updates in the public archive.';
  setLink(document.querySelector('[data-featured-link]'), '/updates', 'Explore the archive', 'Explore the policy update archive');
  setLink(document.querySelector('[data-latest-link]'), '/updates', 'Browse policy updates', 'Browse policy updates');
  const pdf = document.querySelector('[data-featured-pdf]');
  pdf.hidden = true;
  pdf.removeAttribute('href');
}

export function renderHomepageUpdates(document, updates) {
  resetFeatured(document);
  const { featured, rows } = selectHomepageUpdates(updates);
  if (featured) {
    const date = document.querySelector('[data-featured-date]');
    date.textContent = featured.displayDate;
    date.hidden = false;
    document.querySelector('[data-featured-title]').textContent = featured.categoryLabel;
    document.querySelector('[data-featured-summary]').textContent = excerpt(featured.summary, 380);
    setLink(document.querySelector('[data-featured-link]'), featured.canonicalUrl, 'Read the memo', `Read the memo: ${featured.title}`);
    setLink(document.querySelector('[data-latest-link]'), featured.canonicalUrl, 'Read the latest memo', `Read the latest memo: ${featured.title}`);
    const pdf = document.querySelector('[data-featured-pdf]');
    if (featured.pdfUrl) {
      pdf.href = featured.pdfUrl;
      pdf.setAttribute('aria-label', `Download PDF: ${featured.title}`);
      pdf.hidden = false;
    }
  }

  const list = document.querySelector('[data-policy-list]');
  list.replaceChildren();
  for (const update of rows) {
    const row = element(document, 'article', 'policy-row');
    const body = element(document, 'div', 'policy-row__body');
    body.append(
      element(document, 'p', 'policy-row__meta', `${update.categoryLabel} · ${update.displayDate}`),
      element(document, 'h3', '', update.shortTitle),
      element(document, 'p', 'policy-row__summary', excerpt(update.summary, 300)),
    );
    const actions = element(document, 'div', 'policy-row__actions');
    actions.append(updateLink(document, update));
    if (update.pdfUrl) actions.append(pdfLink(document, update));
    row.append(icon(document, 'file-earmark-text', 'policy-row__icon'), body, actions);
    list.append(row);
  }
  const status = document.querySelector('[data-feed-status]');
  status.textContent = rows.length ? 'Latest policy updates loaded.' : featured ? 'Read the latest memo above, or explore the full archive.' : 'New policy updates will appear here when published. Explore our work below.';
  status.className = rows.length ? 'sr-only' : '';
}

export async function loadHomepageUpdates(document, fetcher = globalThis.fetch) {
  const status = document.querySelector('[data-feed-status]');
  const retry = document.querySelector('[data-feed-retry]');
  const list = document.querySelector('[data-policy-list]');
  status.className = '';
  status.textContent = 'Loading the latest policy updates…';
  retry.hidden = true;
  list.setAttribute('aria-busy', 'true');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher('/updates/feed.json', {
      cache: 'no-store', credentials: 'omit', signal: controller.signal,
    });
    if (!response.ok) throw new Error('Policy update feed unavailable');
    renderHomepageUpdates(document, normalizeUpdates(await response.json()));
  } catch {
    status.textContent = 'The latest updates could not be loaded. Visit the full archive or try again.';
    retry.hidden = false;
  } finally {
    clearTimeout(timeout);
    list.setAttribute('aria-busy', 'false');
  }
}

if (typeof document !== 'undefined' && document.querySelector('[data-policy-list]')) {
  document.querySelector('[data-feed-retry]').addEventListener('click', () => loadHomepageUpdates(document));
  loadHomepageUpdates(document);
}
