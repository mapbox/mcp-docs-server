// Cross-platform build helper script
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Create directory recursively (cross-platform equivalent of mkdir -p)
function mkdirp(dirPath) {
  const absolutePath = path.resolve(dirPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

// Run a git command, returning a fallback string if git is unavailable
function tryGit(args, fallback = 'unknown') {
  try {
    return execSync(`git ${args}`, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

// Generate version info
function generateVersion() {
  mkdirp('dist');

  const sha = tryGit('rev-parse HEAD');
  const tag = tryGit('describe --tags --always');
  const branch = tryGit('rev-parse --abbrev-ref HEAD');
  const version = process.env.npm_package_version;

  const versionInfo = {
    sha,
    tag,
    branch,
    version
  };

  fs.writeFileSync('dist/esm/version.json', JSON.stringify(versionInfo, null, 2));
  fs.writeFileSync('dist/commonjs/version.json', JSON.stringify(versionInfo, null, 2));

  console.log('Generated version.json:', versionInfo);
}

// Process command line arguments
const command = process.argv[2];

switch (command) {
  case 'generate-version':
    generateVersion();
    break;
  default:
    console.error('Unknown command:', command);
    process.exit(1);
}
