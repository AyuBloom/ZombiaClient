import fs from 'fs';

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error("GITHUB_TOKEN is not set in the environment.");
  process.exit(1);
}

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;

const repo = "AyuBloom/MilkTea";
const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tagName}`;

async function run() {
  console.log(`Fetching release info for tag ${tagName}...`);
  const res = await fetch(releaseUrl, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Tauri-Updater-Builder'
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch release: ${res.statusText}`);
    const body = await res.text();
    console.error(body);
    process.exit(1);
  }

  const release = await res.json();
  const assets = release.assets;

  const updater = {
    version: version,
    notes: release.body || `Release ${tagName}`,
    pub_date: release.published_at,
    platforms: {}
  };

  for (const asset of assets) {
    const name = asset.name;

    // We only process update installer files
    const isUpdateAsset = 
      name.endsWith('.app.tar.gz') || 
      name.endsWith('.nsis.zip') || 
      name.endsWith('.msi.zip') ||
      name.endsWith('.zip') || 
      name.endsWith('.exe') || 
      name.endsWith('.msi') || 
      name.endsWith('.AppImage');

    if (isUpdateAsset && !name.endsWith('.sig')) {
      // Find the corresponding signature file
      const sigName = `${name}.sig`;
      const sigAsset = assets.find(a => a.name === sigName);

      if (!sigAsset) {
        console.warn(`No signature file found for asset: ${name}`);
        continue;
      }

      console.log(`Fetching signature for ${name} from ${sigAsset.name}...`);
      const sigRes = await fetch(sigAsset.browser_download_url, {
        headers: {
          Authorization: `token ${githubToken}`,
          'User-Agent': 'Tauri-Updater-Builder'
        }
      });

      if (!sigRes.ok) {
        console.error(`Failed to fetch signature content for ${sigAsset.name}`);
        continue;
      }

      const signature = (await sigRes.text()).trim();

      // Map platform based on filename
      let platformKey = null;

      // macOS
      if (name.endsWith('.app.tar.gz') || name.endsWith('.dmg')) {
        if (name.includes('aarch64') || name.includes('arm64')) {
          platformKey = 'darwin-aarch64';
        } else if (name.includes('x64') || name.includes('x86_64')) {
          platformKey = 'darwin-x86_64';
        }
      } 
      // Windows
      else if (name.endsWith('.zip') || name.endsWith('.exe') || name.endsWith('.msi')) {
        if (name.includes('x64') || name.includes('x86_64')) {
          platformKey = 'windows-x86_64';
        } else if (name.includes('x86') || name.includes('i686')) {
          platformKey = 'windows-i686';
        } else if (name.includes('arm64') || name.includes('aarch64')) {
          platformKey = 'windows-aarch64';
        }
      }
      // Linux
      else if (name.endsWith('.AppImage') || name.endsWith('.deb')) {
        if (name.includes('amd64') || name.includes('x86_64')) {
          platformKey = 'linux-x86_64';
        } else if (name.includes('aarch64') || name.includes('arm64')) {
          platformKey = 'linux-aarch64';
        }
      }

      if (platformKey) {
        // If we already have an asset for this platform, prefer updates (.tar.gz / .zip) over full installers
        if (updater.platforms[platformKey]) {
          const currentUrl = updater.platforms[platformKey].url;
          // Prefer tar.gz over dmg for macOS
          if (platformKey.startsWith('darwin-') && currentUrl.endsWith('.dmg') && name.endsWith('.tar.gz')) {
            updater.platforms[platformKey] = { signature, url: asset.browser_download_url };
          }
        } else {
          updater.platforms[platformKey] = {
            signature,
            url: asset.browser_download_url
          };
        }
      }
    }
  }

  console.log('Generated updater.json:');
  console.log(JSON.stringify(updater, null, 2));

  fs.writeFileSync('updater.json', JSON.stringify(updater, null, 2));
  console.log('updater.json saved successfully.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
