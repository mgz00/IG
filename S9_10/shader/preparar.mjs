import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('./',import.meta.url);
const readable=readFileSync(new URL('shaders/disformidad-readable.frag',root),'utf8');
const shader=readable.replace(/\/\/[^\r\n]*/g,'').replace(/\s+/g,' ').replace(/\s*([{}();,+*/=<>-])\s*/g,'$1').trim();
const bytes=Buffer.byteLength(shader);
if(bytes>512)throw Error(`Supera el límite: ${bytes} bytes`);
writeFileSync(new URL('shaders/disformidad.frag',root),shader);
writeFileSync(new URL('shader-sources.js',root),'// Generado con node preparar.mjs\nwindow.WARP='+JSON.stringify({shader,readable,bytes})+';\n');
console.log(`Disformidad: ${bytes} bytes UTF-8, incluidos precisión y uniforms.`);
