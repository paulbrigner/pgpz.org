import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';

const root = process.cwd();
const htmlFiles = ['index.html', '404.html', 'community/index.html', 'coalition/index.html'];
const textFiles = [
  ...htmlFiles,
  'README.md',
  'assets/css/site.css',
  'assets/js/site.js',
  'robots.txt',
  'sitemap.xml',
];

const requiredFiles = [
  ...textFiles,
  'favicon.ico',
  'assets/brand/pgpz-primary-on-dark-2048w.png',
  'assets/brand/pgpz-circle-motif-on-dark-2400w.png',
  'assets/images/pgpz-social-card-v4.png',
  'assets/images/pgpz-favicon.png',
  'assets/fonts/Inter-Regular.ttf',
  'assets/fonts/Inter-Medium.ttf',
  'assets/fonts/Inter-Semibold.ttf',
  'assets/fonts/Inter-Extrabold.ttf',
  'assets/fonts/OFL.txt',
];

const expectedBrandChecksums = {
  'assets/brand/pgpz-primary-on-dark-2048w.png': '07faba90390e642e42fbbd4ddfc67445514738e91d474deaf843313b02b4760b',
  'assets/brand/pgpz-circle-motif-on-dark-2400w.png': '3a288051f490eaf330a504d5eaf3df90e9ecb66d60aa7848aa35146f2bbd3872',
};

const failures = [];
const longName = ['Pretty', 'Good', 'Policy'].join(' ');
const standaloneLongName = new RegExp(`${longName}(?! for Zcash)`, 'i');

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

for (const [file, expected] of Object.entries(expectedBrandChecksums)) {
  if (!existsSync(join(root, file))) continue;
  const actual = createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
  if (actual !== expected) {
    failures.push(`Brand asset checksum mismatch: ${file}`);
  }
}

for (const file of textFiles) {
  if (!existsSync(join(root, file))) continue;
  const content = readFileSync(join(root, file), 'utf8');

  if (standaloneLongName.test(content)) {
    failures.push(`Standalone long-form brand wording in ${file}`);
  }

  if (/Coming Soon|cdn\.tailwindcss\.com|fonts\.googleapis\.com/i.test(content)) {
    failures.push(`Retired placeholder or external runtime dependency in ${file}`);
  }
}

for (const file of htmlFiles) {
  if (!existsSync(join(root, file))) continue;
  const content = readFileSync(join(root, file), 'utf8');
  const baseDirectory = dirname(file);
  const references = [...content.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(reference)) continue;

    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!cleanReference) continue;

    let localPath = cleanReference.startsWith('/')
      ? cleanReference.slice(1)
      : normalize(join(baseDirectory, cleanReference));

    if (localPath.endsWith('/')) localPath = join(localPath, 'index.html');
    if (!extname(localPath) && existsSync(join(root, localPath, 'index.html'))) {
      localPath = join(localPath, 'index.html');
    }

    if (!existsSync(join(root, localPath))) {
      failures.push(`Broken local reference in ${file}: ${reference}`);
    }
  }
}

const home = existsSync(join(root, 'index.html'))
  ? readFileSync(join(root, 'index.html'), 'utf8')
  : '';

if (!home.includes('href="https://z.cash/"')) {
  failures.push('Homepage is missing the required official Zcash link.');
}

if (!home.includes('not affiliated with or endorsed by the Zcash Foundation')) {
  failures.push('Homepage is missing the independence and non-endorsement statement.');
}

if (!home.includes('aria-label="Official Zcash website"')) {
  failures.push('Composite brand signature is missing an accessible Zcash-logo link.');
}

if (failures.length > 0) {
  console.error('Site validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Site validation passed (${requiredFiles.length} required files, ${htmlFiles.length} HTML pages).`);
