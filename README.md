# pgpz.org

Static public website for Pretty Good Policy for Zcash (PGPZ).

## Local validation

```sh
node scripts/validate-site.mjs
node --test scripts/policy-updates.test.mjs
python3 -m http.server 4173
```

The site has no runtime framework or third-party browser dependency. Inter is self-hosted from the approved brand package, and the public pages share `assets/css/site.css`.

## Brand implementation

- Use the released v4 evergreen, paper, slate, teal, and gold tokens.
- Always use the complete long-form name, including its `for Zcash` ending, in site-authored text.
- Keep the supplied composite brand artwork unchanged.
- The transparent link area over the official Zcash roundel must continue to point to `https://z.cash/`.
- Keep the independence and non-endorsement statement in the persistent footer.
- Use the released social-package exports for social previews; use PGPZ-only artwork when the composite brandmark is not suitable.

The validation script pins checksums for the exact brand-package artwork published by this site.

## Deployment

Pushes to `main` validate the site, build an allowlisted `_site` directory, sync that public bundle to the `pgpz.org` S3 bucket, and invalidate CloudFront. Repository metadata, workflow files, scripts, and brand-governance source materials are not included in the public bundle.

## Public policy updates

The homepage follows the selected split-hero design: the latest Weekly Policy Memo, two recent analysis rows, and a clear path into Community participation. Existing organization, leadership, privacy, priorities, and brand content remains below these sections.

`assets/js/policy-updates.mjs` reads `/updates/feed.json` with no cache or credentials. It selects the latest weekly memo and, when available, a different recent weekly memo plus a Special Update. Titles, dates, summaries, and PDF links come only from that published feed; the homepage contains no hardcoded dated memo content. If the feed is empty or unavailable, archive links remain usable and the page offers a retry. Without JavaScript, the archive and all organization content remain accessible.

The `/updates` and `/updates/*` routes are served by the separate Community-owned public reader behind CloudFront. That reader owns publication filtering, full HTML pages, the feed, PDFs, media, and `/updates/sitemap.xml`. The static site does not store memo content, handle member sessions, or publish drafts. Authoring, review, publication, and member email distribution remain in Community admin. Public reader route deployment must be verified before deploying this homepage. The current static S3 sync therefore needs no publication-content exception: policy content is not stored in the static-site bucket.

For local preview, a plain static server displays the loading/failure fallback until `/updates/feed.json` is routed to the reader. Browser verification should also exercise a populated feed, an empty feed, a failed feed, keyboard navigation, and mobile layouts. `scripts/policy-updates.test.mjs` covers selection, safe canonical links, text-only rendering, request isolation, and these data states using Node's built-in test runner.

The four small line icons are vendored from [Bootstrap Icons 1.11.3](https://github.com/twbs/icons/tree/v1.11.3), with their MIT license in `assets/icons/bootstrap/LICENSE`. No third-party script, font, or browser framework is loaded.
