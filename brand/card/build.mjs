import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const fontCss = fs.readFileSync(path.join(here, 'src', 'poppins-inline.css'), 'utf8');
for (const f of fs.readdirSync(path.join(here, 'src')).filter(f => f.endsWith('.tpl.html'))) {
  const name = f.replace('.tpl.html', '.dc.html');
  const src = fs.readFileSync(path.join(here, 'src', f), 'utf8');
  if (!src.includes('/*FONTS*/')) throw new Error('no FONTS marker in ' + f);
  fs.writeFileSync(path.join(here, name), src.replace('/*FONTS*/', fontCss));
  console.log('built', name);
}
