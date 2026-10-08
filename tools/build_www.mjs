// Copies the web app's own files into www/ (what the Android app bundles). Nothing private (notes, video files, music
// made for videos, the CV) is ever copied: only the allow-listed files and folders below.
// Run:  node tools/build_www.mjs      (npm run sync also updates the Android project)
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

const FILES = ['index.html', 'intro.js', 'manifest.webmanifest'];
const DIRS = ['css', 'js', 'icons', 'assets'];
const SOUNDS = ['intro.mp3', 'tap.mp3', 'whoosh-cinematic.mp3', 'whoosh-short.mp3'];   // only the sounds the app plays

rmSync('www', { recursive: true, force: true });
mkdirSync('www/sounds', { recursive: true });
for (const f of FILES) cpSync(f, 'www/' + f);
for (const d of DIRS) cpSync(d, 'www/' + d, { recursive: true });
for (const s of SOUNDS){ if (!existsSync('sounds/' + s)) throw new Error('missing sounds/' + s); cpSync('sounds/' + s, 'www/sounds/' + s); }
console.log('www/ ready:', readdirSync('www').join(', '));
