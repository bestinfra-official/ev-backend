/**
 * Clean all node_modules directories
 * Works on both Windows and Unix-like systems
 */

import { rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("🧹 Cleaning all node_modules directories...\n");

const pathsToClean = [join(__dirname, "node_modules")];

// Add all service node_modules
const servicesDir = join(__dirname, "services");
try {
    const services = await readdir(servicesDir);
    for (const service of services) {
        pathsToClean.push(join(servicesDir, service, "node_modules"));
    }
} catch (error) {
    // Services directory might not exist
}

let cleaned = 0;
let skipped = 0;

for (const path of pathsToClean) {
    if (existsSync(path)) {
        try {
            console.log(`Removing: ${path}`);
            rmSync(path, { recursive: true, force: true });
            cleaned++;
        } catch (error) {
            console.error(`Failed to remove ${path}:`, error.message);
        }
    } else {
        skipped++;
    }
}

console.log(`\n✅ Cleaned ${cleaned} directories (${skipped} already clean)`);
console.log("Run 'npm start' to reinstall and start services\n");
