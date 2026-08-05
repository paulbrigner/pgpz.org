# pgpz.org

Static public website for Pretty Good Policy for Zcash (PGPZ).

## Local validation

```sh
node scripts/validate-site.mjs
python3 -m http.server 4173
```

The site has no runtime framework or third-party browser dependency. Inter is self-hosted from the approved brand package, and the public pages share `assets/css/site.css`.

## Brand implementation

- Use the approved draft-v4 evergreen, paper, slate, teal, and gold tokens.
- Always use the complete long-form name, including its `for Zcash` ending, in site-authored text.
- Keep the supplied composite brand artwork unchanged.
- The transparent link area over the official Zcash roundel must continue to point to `https://z.cash/`.
- Keep the independence and non-endorsement statement in the persistent footer.
- Use only a PGPZ-only favicon or social asset when the official Zcash roundel cannot be hyperlinked.

The validation script pins checksums for the exact brand-package artwork published by this site.

## Deployment

Pushes to `main` validate the site, build an allowlisted `_site` directory, sync that public bundle to the `pgpz.org` S3 bucket, and invalidate CloudFront. Repository metadata, workflow files, scripts, and brand-governance source materials are not included in the public bundle.
