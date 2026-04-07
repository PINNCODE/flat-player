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

async function rewriteIndex() {
  const html = await fs.readFile(indexPath, 'utf8');
  const withoutModulePreload = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
  const rewrittenScript = withoutModulePreload.replace(
    /<script\s+src="[^"]+"\s+type="module"><\/script>/,
    `<script src="${tizenBundleName}"></script>`,
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

  await rewriteIndex();
  console.log(`Tizen bundle generado: ${outputFile}`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
