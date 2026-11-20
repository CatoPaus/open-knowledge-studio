import * as fs from 'fs';
import * as path from 'path';

const dirsToRemove = [
  path.resolve('workspace/runs')
];

console.log('Starting workspace cleanup...');

for (const dir of dirsToRemove) {
  if (fs.existsSync(dir)) {
    console.log(`Removing directory: ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('Cleanup completed successfully!');
