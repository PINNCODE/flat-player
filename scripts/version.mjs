import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const [,, type] = process.argv;

if (!type || !['major', 'minor', 'patch'].includes(type)) {
  console.error('Usage: node version.mjs <major|minor|patch>');
  process.exit(1);
}

const packagePath = join(rootDir, 'package.json');
const versionTsPath = join(rootDir, 'src/app/version.ts');

const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

const newVersion = type === 'major'
  ? `${major + 1}.0.0`
  : type === 'minor'
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

pkg.version = newVersion;

writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
writeFileSync(versionTsPath, `export const APP_VERSION = '${newVersion}';\n`);

console.log(`Version bumped: ${pkg.version} → ${newVersion}`);
