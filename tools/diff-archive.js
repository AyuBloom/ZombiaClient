#!/usr/bin/env node

/**
 * Zombia Client Archive Diff Tool
 * Utility to compare the closest / most recent versions of app.js (located in ./archive)
 * 
 * Usage:
 *   node tools/diff-archive.js [options] [versionA] [versionB]
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// ANSI escape codes for premium console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

function printBanner() {
    console.log(`${colors.bright}${colors.cyan}====================================================`);
    console.log(`          ✦ ARCHIVED APP.JS DIFF TOOL ✦             `);
    console.log(`====================================================${colors.reset}\n`);
}

function printUsage() {
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  pnpm run diff-archive [options] [versionA] [versionB]\n`);
    console.log(`${colors.bright}Options:${colors.reset}`);
    console.log(`  ${colors.yellow}-h, --help${colors.reset}       : Show this help message`);
    console.log(`  ${colors.yellow}-l, --list${colors.reset}       : List all versioned files in the archive\n`);
    console.log(`${colors.bright}Examples:${colors.reset}`);
    console.log(`  pnpm run diff-archive                  : Compare two most recent versions`);
    console.log(`  pnpm run diff-archive v3.0.1           : Compare v3.0.1 with the version preceding it`);
    console.log(`  pnpm run diff-archive v3.0.1 v3.0.2    : Compare v3.0.1 with v3.0.2 explicitly\n`);
}

function parseVersion(filename) {
    const match = filename.match(/^v?(\d+)\.(\d+)\.(\d+)(-.+)?\.js$/);
    if (!match) return null;
    return {
        filename,
        versionStr: filename.replace(/\.js$/, ''),
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4] || ''
    };
}

function compareVersions(a, b) {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    return a.prerelease.localeCompare(b.prerelease);
}

function findFile(arg, list) {
    const cleanArg = arg.toLowerCase().replace(/^v/, '').replace(/\.js$/, '');
    
    // Look for exact match in versionStr or filename
    for (const item of list) {
        const cleanVer = item.versionStr.toLowerCase().replace(/^v/, '');
        if (cleanVer === cleanArg || item.filename.toLowerCase() === arg.toLowerCase()) {
            return item;
        }
    }
    
    // Check if it exists as a direct path
    if (fs.existsSync(arg)) {
        return {
            filename: path.basename(arg),
            filepath: path.resolve(arg),
            versionStr: path.basename(arg)
        };
    }
    
    return null;
}

async function main() {
    const args = process.argv.slice(2);

    const helpIndex = args.findIndex(arg => arg === '-h' || arg === '--help');
    if (helpIndex !== -1) {
        printBanner();
        printUsage();
        process.exit(0);
    }

    const archiveDir = path.join(process.cwd(), 'archive');
    if (!fs.existsSync(archiveDir)) {
        console.error(`${colors.red}❌ Error: Archive directory "${archiveDir}" does not exist.${colors.reset}`);
        process.exit(1);
    }

    const files = fs.readdirSync(archiveDir);
    const versionedFiles = [];
    const otherJsFiles = [];

    for (const file of files) {
        if (!file.endsWith('.js')) continue;
        const parsed = parseVersion(file);
        if (parsed) {
            versionedFiles.push(parsed);
        } else {
            otherJsFiles.push(file);
        }
    }

    // Sort semver files ascending (e.g. 3.0.1 before 3.0.2)
    versionedFiles.sort(compareVersions);

    // If no semver files were found, fallback to modification time for other JS files
    if (versionedFiles.length === 0 && otherJsFiles.length > 0) {
        const fileStats = otherJsFiles.map(file => ({
            filename: file,
            versionStr: file.replace(/\.js$/, ''),
            mtime: fs.statSync(path.join(archiveDir, file)).mtimeMs
        }));
        fileStats.sort((a, b) => a.mtime - b.mtime);
        
        versionedFiles.push(...fileStats.map(f => ({
            filename: f.filename,
            versionStr: f.versionStr,
            major: 0,
            minor: 0,
            patch: 0,
            prerelease: '',
            isFallback: true
        })));
    }

    const listIndex = args.findIndex(arg => arg === '-l' || arg === '--list');
    if (listIndex !== -1) {
        printBanner();
        console.log(`${colors.bright}Found ${colors.cyan}${versionedFiles.length}${colors.reset} JS files in archive:${colors.reset}`);
        if (versionedFiles.length === 0) {
            console.log(`  ${colors.dim}(None found)${colors.reset}`);
        } else {
            versionedFiles.forEach((file, idx) => {
                const label = file.isFallback ? ' (sorted by mtime)' : '';
                console.log(`  ${colors.green}${idx + 1}.${colors.reset} ${colors.bright}${file.filename}${colors.reset}${colors.dim}${label}${colors.reset}`);
            });
        }
        process.exit(0);
    }

    let fileA, fileB;

    // Filter out options if they are mixed in positional arguments
    const positionalArgs = args.filter(arg => !arg.startsWith('-'));

    if (positionalArgs.length === 0) {
        if (versionedFiles.length < 2) {
            printBanner();
            console.error(`${colors.red}❌ Error: Not enough files in archive to perform a diff.${colors.reset}`);
            console.error(`Found ${versionedFiles.length} file(s) in "${archiveDir}". Need at least 2 files.`);
            process.exit(1);
        }
        fileA = versionedFiles[versionedFiles.length - 2];
        fileB = versionedFiles[versionedFiles.length - 1];
    } else if (positionalArgs.length === 1) {
        const target = findFile(positionalArgs[0], versionedFiles);
        if (!target) {
            console.error(`${colors.red}❌ Error: Could not resolve version or file "${positionalArgs[0]}" in archive.${colors.reset}`);
            process.exit(1);
        }
        
        const idx = versionedFiles.findIndex(f => f.filename === target.filename);
        if (idx === -1) {
            console.error(`${colors.red}❌ Error: Specified file "${target.filename}" is not in the archive list.${colors.reset}`);
            process.exit(1);
        }
        
        if (idx > 0) {
            fileA = versionedFiles[idx - 1];
            fileB = target;
        } else if (idx < versionedFiles.length - 1) {
            fileA = target;
            fileB = versionedFiles[idx + 1];
        } else {
            console.error(`${colors.red}❌ Error: Version "${target.filename}" is the only file in the archive. Cannot perform a diff.${colors.reset}`);
            process.exit(1);
        }
    } else {
        fileA = findFile(positionalArgs[0], versionedFiles);
        fileB = findFile(positionalArgs[1], versionedFiles);
        
        if (!fileA) {
            console.error(`${colors.red}❌ Error: Could not resolve version or file "${positionalArgs[0]}"${colors.reset}`);
            process.exit(1);
        }
        if (!fileB) {
            console.error(`${colors.red}❌ Error: Could not resolve version or file "${positionalArgs[1]}"${colors.reset}`);
            process.exit(1);
        }
        
        // Ensure chronological ordering in standard output
        if (fileA.filepath === undefined && fileB.filepath === undefined) {
            const idxA = versionedFiles.findIndex(f => f.filename === fileA.filename);
            const idxB = versionedFiles.findIndex(f => f.filename === fileB.filename);
            if (idxA > idxB) {
                const temp = fileA;
                fileA = fileB;
                fileB = temp;
            }
        }
    }

    const pathA = fileA.filepath || path.join(archiveDir, fileA.filename);
    const pathB = fileB.filepath || path.join(archiveDir, fileB.filename);

    printBanner();
    console.log(`${colors.blue}ℹ Comparing: ${colors.bright}${colors.yellow}${fileA.filename}${colors.reset} ➜ ${colors.bright}${colors.green}${fileB.filename}${colors.reset}`);
    console.log(`${colors.dim}Running: git diff --no-index --color "${pathA}" "${pathB}"${colors.reset}\n`);

    const diffProcess = spawn('git', ['diff', '--no-index', '--color', pathA, pathB], {
        stdio: 'inherit'
    });

    diffProcess.on('error', (err) => {
        console.error(`${colors.red}❌ Failed to start git diff process:${colors.reset}`, err.message);
        console.log(`${colors.yellow}ℹ Trying fallback to standard diff...${colors.reset}`);
        
        const fallbackProcess = spawn('diff', ['-u', pathA, pathB], {
            stdio: 'inherit'
        });
        fallbackProcess.on('close', (code) => {
            process.exit(code);
        });
    });

    diffProcess.on('close', (code) => {
        // git diff --no-index exits with 1 if differences exist, which is normal.
        if (code === 0 || code === 1) {
            process.exit(0);
        } else {
            process.exit(code);
        }
    });
}

main().catch(err => {
    console.error(`${colors.red}❌ Critical error in diff tool:${colors.reset}`, err);
    process.exit(1);
});
