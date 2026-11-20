import * as fs from 'fs';
import { fileURLToPath } from 'url';

export const OKF_VIZ_CSS = fs
  .readFileSync(fileURLToPath(new URL('./client/viz.css', import.meta.url)), 'utf-8')
  .trim();

export const OKF_VIZ_JS = fs
  .readFileSync(fileURLToPath(new URL('./client/viz.js', import.meta.url)), 'utf-8')
  .trim();
