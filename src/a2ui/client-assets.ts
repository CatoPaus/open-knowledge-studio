import * as fs from 'fs';
import { fileURLToPath } from 'url';

export const A2UI_STUDIO_CSS = fs
  .readFileSync(fileURLToPath(new URL('./client/studio.css', import.meta.url)), 'utf-8')
  .trim();

export const A2UI_STUDIO_JS = fs
  .readFileSync(fileURLToPath(new URL('./client/studio.js', import.meta.url)), 'utf-8')
  .trim();
