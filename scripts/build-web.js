import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const www = path.join(root, 'www');
const src = path.join(root, 'src');

fs.mkdirSync(path.join(www, 'js'), { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(src, 'app.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(www, 'js', 'app.js'),
  sourcemap: true,
  target: ['es2020'],
});

fs.copyFileSync(path.join(root, 'index.html'), path.join(www, 'index.html'));
console.log('Built screen-vocab → www/');
