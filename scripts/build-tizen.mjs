import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist/flat-player/browser');
const indexPath = path.join(distRoot, 'index.html');
const tizenBundleName = 'app.tizen.js';

async function findMainBundle() {
  const files = await fs.readdir(distRoot);
  const mainFile = files.find((file) => /^main-[A-Z0-9]+\.js$/i.test(file));

  if (!mainFile) {
    throw new Error('No se encontro el bundle principal en dist/flat-player/browser. Ejecuta ng build primero.');
  }

  return path.join(distRoot, mainFile);
}

/**
 * Reemplaza `inset: <value>` por las cuatro propiedades físicas equivalentes
 * para compatibilidad con WebKit antiguo en Tizen (no soporta CSS Logical Properties).
 *
 * Parchea tanto los archivos .css como los bundles .js, ya que Angular embebe
 * los estilos de componente como strings dentro del bundle JS principal.
 */
async function patchCssForTizen() {
  const files = await fs.readdir(distRoot);

  const insetReplacer = (match, value) => {
    const parts = value.trim().split(/\s+/);
    if (parts.length === 1) {
      return `top:${parts[0]};right:${parts[0]};bottom:${parts[0]};left:${parts[0]};`;
    }
    if (parts.length === 2) {
      return `top:${parts[0]};right:${parts[1]};bottom:${parts[0]};left:${parts[1]};`;
    }
    if (parts.length === 3) {
      return `top:${parts[0]};right:${parts[1]};bottom:${parts[2]};left:${parts[1]};`;
    }
    if (parts.length === 4) {
      return `top:${parts[0]};right:${parts[1]};bottom:${parts[2]};left:${parts[3]};`;
    }
    return match;
  };

  // La clase de caracteres excluye comillas y backticks para no cruzar limites de string JS.
  const insetRegex = /\binset:([^;}{\'\"`]+);/g;

  const cssFiles = files.filter((f) => f.endsWith('.css'));
  for (const cssFile of cssFiles) {
    const filePath = path.join(distRoot, cssFile);
    let content = await fs.readFile(filePath, 'utf8');
    content = content.replace(insetRegex, insetReplacer);
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Tizen CSS patched: ${cssFile}`);
  }

  // Angular embebe los estilos de componente como strings dentro del bundle JS.
  // Se parchea el app.tizen.js y los chunks JS del dist.
  const jsFiles = [tizenBundleName, ...files.filter((f) => f.endsWith('.js') && f !== tizenBundleName)];
  for (const jsFile of jsFiles) {
    const filePath = path.join(distRoot, jsFile);
    let content = await fs.readFile(filePath, 'utf8');
    const patched = content.replace(insetRegex, insetReplacer);
    if (patched !== content) {
      await fs.writeFile(filePath, patched, 'utf8');
      console.log(`Tizen JS  patched: ${jsFile}`);
    }
  }
}

async function rewriteIndex() {
  const html = await fs.readFile(indexPath, 'utf8');
  const withoutModulePreload = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
  const rewrittenScript = withoutModulePreload.replace(
    /<script\s+src="[^"]+"\s+type="module"><\/script>/,
    '<script src="' + tizenBundleName + '"></script>',
  );

  if (rewrittenScript === html) {
    throw new Error('No se pudo reescribir index.html para Tizen. Verifica el formato del script principal.');
  }

  await fs.writeFile(indexPath, rewrittenScript, 'utf8');
}

async function run() {
  const entryPoint = await findMainBundle();
  const outputFile = path.join(distRoot, tizenBundleName);

  await build({
    entryPoints: [entryPoint],
    outfile: outputFile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    minify: true,
    legalComments: 'none',
  });

  await patchCssForTizen();
  await rewriteIndex();
  console.log('Tizen bundle generado: ' + outputFile);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
