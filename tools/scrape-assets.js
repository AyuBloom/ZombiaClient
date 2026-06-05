import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Roots relative to the project directory
const PROJECT_ROOT = path.resolve(__dirname, '..');
const STATIC_IMAGES_DIR = path.join(PROJECT_ROOT, 'static/images');

// Helper to download a URL to text
async function downloadFile(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const content = await res.text();
    if (!content.trim().startsWith('<svg')) {
      throw new Error('Returned content does not look like a valid SVG (does not start with <svg)');
    }
    return content;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return null;
  }
}

// Traverse directory recursively to find all SVG files
function getSvgFiles(dir, filesList = []) {
  if (!fs.existsSync(dir)) {
    return filesList;
  }
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getSvgFiles(fullPath, filesList);
    } else if (stat.isFile() && item.endsWith('.svg')) {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

async function main() {
  console.log(`Scanning existing SVGs in: ${STATIC_IMAGES_DIR}...`);
  const svgFiles = getSvgFiles(STATIC_IMAGES_DIR);
  console.log(`Mapped out ${svgFiles.length} SVG files.`);

  let successCount = 0;
  for (const file of svgFiles) {
    const relativePath = path.relative(STATIC_IMAGES_DIR, file);
    const url = `http://zombia.io/asset/images/${relativePath}`;

    console.log(`Fetching ${relativePath} from ${url}...`);
    const svgContent = await downloadFile(url);
    if (svgContent) {
      fs.writeFileSync(file, svgContent, 'utf8');
      console.log(`Successfully updated: ${relativePath}`);
      successCount++;
    }

    // Add a small delay between downloads to prevent overloading the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`Scraping complete! Successfully refreshed ${successCount}/${svgFiles.length} assets.`);
}

main();
