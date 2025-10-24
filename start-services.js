/**
 * EV Platform - Service Orchestrator
 *
 * Automatically detects and starts all implemented microservices
 * that have a server.js file and package.json
 */

import { spawn, execSync, exec } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir } from "fs/promises";
import {
    SERVICE_PORTS,
    GATEWAY_PORT,
    getEnabledServices,
    isServiceEnabled,
} from "./config/services.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVICES_DIR = join(__dirname, "services");

/**
 * Install dependencies for npm workspace (at root level)
 */
async function installDependencies() {
    const nodeModulesPath = join(__dirname, "node_modules");

    // Skip if node_modules already exists
    if (existsSync(nodeModulesPath)) {
        console.log("✅ Dependencies already installed\n");
        return;
    }

    console.log("📦 Installing dependencies for all workspaces...");
    console.log("   This may take a few minutes...\n");

    return new Promise((resolve, reject) => {
        const installProcess = spawn("npm", ["install"], {
            cwd: __dirname,
            stdio: "inherit",
            shell: true,
        });

        installProcess.on("error", (error) => {
            console.error("❌ Failed to install dependencies:", error.message);
            reject(error);
        });

        installProcess.on("exit", (code) => {
            if (code === 0) {
                console.log("\n✅ All dependencies installed successfully!\n");
                resolve();
            } else {
                console.error(`❌ npm install exited with code ${code}\n`);
                reject(new Error("npm install failed"));
            }
        });
    });
}

// Service port assignments are now imported from centralized config

const processes = [];
let shutdownInProgress = false;

/**
 * Check if a service is ready to be started
 */
function isServiceReady(serviceName) {
    const servicePath = join(SERVICES_DIR, serviceName);
    const serverFile = join(servicePath, "server.js");
    const indexFile = join(servicePath, "index.js");
    const packageFile = join(servicePath, "package.json");

    return (
        (existsSync(serverFile) || existsSync(indexFile)) &&
        existsSync(packageFile)
    );
}

/**
 * Start a single service
 */
function startService(serviceName, port) {
    return new Promise((resolve, reject) => {
        const servicePath = join(SERVICES_DIR, serviceName);

        console.log(`\n🚀 Starting ${serviceName} on port ${port}...`);

        // Set environment variables for the service
        const env = {
            ...process.env,
            PORT: port.toString(),
            SERVICE_NAME: serviceName,
            NODE_ENV: process.env.NODE_ENV || "development",
        };

        // Use npm start to run the service (suppress npm output)
        const serviceProcess = spawn("npm", ["start", "--silent"], {
            cwd: servicePath,
            env,
            stdio: ["ignore", "pipe", "pipe"],
            shell: true,
        });

        // Buffer and prefix service output
        const prefixOutput = (data, isError = false) => {
            const lines = data
                .toString()
                .split("\n")
                .filter((line) => line.trim());
            lines.forEach((line) => {
                // Skip noisy logs
                if (line.includes("npm") && line.includes("@ev-platform"))
                    return;
                if (line.includes("node_modules")) return;
                if (line.includes("[dotenv")) return;
                if (
                    line.includes("service:") &&
                    !line.includes("running on port")
                )
                    return;

                // Only show important logs
                const isImportant =
                    isError ||
                    line.includes("ERROR") ||
                    line.includes("WARN") ||
                    line.includes("running on port") ||
                    line.includes("connected") ||
                    line.includes("initialized") ||
                    line.includes("failed") ||
                    line.toLowerCase().includes("error");

                if (!isImportant) return;

                // Clean and format the line
                let cleanLine = line
                    .replace(/\[\d{2}:\d{2}:\d{2}\]\s*/, "")
                    .replace(/INFO:\s*/, "")
                    .replace(/ERROR:\s*/, "❌ ")
                    .replace(/WARN:\s*/, "⚠️  ")
                    .trim();

                const prefix = isError ? `   ❌` : `   ✓`;
                console.log(`${prefix} [${serviceName}] ${cleanLine}`);
            });
        };

        const stdoutHandler = (data) => {
            if (!shutdownInProgress) prefixOutput(data, false);
        };
        const stderrHandler = (data) => {
            if (!shutdownInProgress) prefixOutput(data, true);
        };

        serviceProcess.stdout?.on("data", stdoutHandler);
        serviceProcess.stderr?.on("data", stderrHandler);

        processes.push({
            name: serviceName,
            process: serviceProcess,
            port,
            stdoutHandler,
            stderrHandler,
        });

        serviceProcess.on("error", (error) => {
            console.error(`❌ Error starting ${serviceName}:`, error.message);
            reject(error);
        });

        serviceProcess.on("exit", (code, signal) => {
            if (!shutdownInProgress && code !== 0) {
                console.log(
                    `   ❌ [${serviceName}] exited with code ${code}\n`
                );
            }
        });

        // Give the service a moment to start and show output
        setTimeout(() => {
            resolve();
        }, 800);
    });
}

/**
 * Start the API Gateway
 */
function startGateway() {
    return new Promise((resolve, reject) => {
        console.log(`\n🌐 Starting API Gateway on port ${GATEWAY_PORT}...`);

        const gatewayProcess = spawn("node", ["index.js"], {
            cwd: __dirname,
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
            shell: true,
        });

        const prefixOutput = (data, isError = false) => {
            const lines = data
                .toString()
                .split("\n")
                .filter((line) => line.trim());
            lines.forEach((line) => {
                // Skip noisy logs
                if (line.includes("[dotenv")) return;
                if (line.includes("service:")) return;

                const prefix = isError ? `   ❌` : `   ✓`;
                const cleanLine = line.replace(/\[dotenv.*?\]\s*/, "").trim();
                console.log(`${prefix} [gateway] ${cleanLine}`);
            });
        };

        const stdoutHandler = (data) => {
            if (!shutdownInProgress) prefixOutput(data, false);
        };
        const stderrHandler = (data) => {
            if (!shutdownInProgress) prefixOutput(data, true);
        };

        gatewayProcess.stdout?.on("data", stdoutHandler);
        gatewayProcess.stderr?.on("data", stderrHandler);

        processes.push({
            name: "api-gateway",
            process: gatewayProcess,
            port: GATEWAY_PORT,
            stdoutHandler,
            stderrHandler,
        });

        gatewayProcess.on("error", (error) => {
            console.error("❌ Error starting API Gateway:", error.message);
            reject(error);
        });

        gatewayProcess.on("exit", (code, signal) => {
            if (!shutdownInProgress && code !== 0) {
                console.log(`   ❌ [gateway] exited with code ${code}\n`);
            }
        });

        setTimeout(() => {
            resolve();
        }, 800);
    });
}

/**
 * Graceful shutdown
 */
function shutdown() {
    if (shutdownInProgress) return;

    shutdownInProgress = true;

    // Count services for message
    let serviceCount = 0;
    processes.forEach(({ name }) => {
        if (name !== "api-gateway") {
            serviceCount++;
        }
    });

    // Show message immediately
    if (serviceCount === 1) {
        console.log("\n\n🛑 Stopping...");
    } else if (serviceCount > 1) {
        console.log(`\n\n🛑 Stopping ${serviceCount} services...`);
    } else {
        console.log("\n\n🛑 Stopping...");
    }

    // Remove listeners and kill - don't wait
    processes.forEach(
        ({ process: childProcess, stdoutHandler, stderrHandler }) => {
            try {
                // Remove listeners
                if (stdoutHandler)
                    childProcess.stdout?.removeListener("data", stdoutHandler);
                if (stderrHandler)
                    childProcess.stderr?.removeListener("data", stderrHandler);

                // Kill without waiting
                if (process.platform === "win32") {
                    // Use async exec - don't wait for it
                    exec(
                        `taskkill /pid ${childProcess.pid} /T /F 2>nul`,
                        () => {}
                    );
                } else {
                    try {
                        process.kill(-childProcess.pid, "SIGKILL");
                    } catch (e) {
                        childProcess.kill("SIGKILL");
                    }
                }
            } catch (error) {
                // Ignore
            }
        }
    );

    // Exit IMMEDIATELY
    process.exit(0);
}

/**
 * Main function
 */
async function main() {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║   EV Platform - Service Orchestrator    ║");
    console.log("╚══════════════════════════════════════════╝\n");

    // Install dependencies if needed (for all workspaces)
    await installDependencies();

    try {
        // Discover available services
        const serviceNames = await readdir(SERVICES_DIR);
        const readyServices = serviceNames.filter(isServiceReady);

        // Get enabled services from configuration
        const enabledServices = getEnabledServices();
        const enabledAndReadyServices = readyServices.filter((name) =>
            enabledServices.includes(name)
        );

        // Filter services based on command-line args or env var
        // Usage: npm start -- auth-management vehicle-management
        // Or:    SERVICES=auth-management npm start
        // Or:    SERVICES=all npm start (to start all services)

        const cliArgs = process.argv.slice(2);
        const envServices = process.env.SERVICES?.split(",").map((s) =>
            s.trim()
        );

        let servicesToStart;
        if (cliArgs.length > 0) {
            // Command line args take priority
            if (cliArgs[0] === "all") {
                servicesToStart = readyServices;
                console.log(`📌 Starting all available services\n`);
            } else {
                servicesToStart = readyServices.filter((name) =>
                    cliArgs.includes(name)
                );
                console.log(
                    `📌 Starting specific services: ${cliArgs.join(", ")}\n`
                );
            }
        } else if (envServices && envServices.length > 0) {
            // Then check environment variable
            if (envServices[0] === "all") {
                servicesToStart = readyServices;
                console.log(`📌 Starting all available services\n`);
            } else {
                servicesToStart = readyServices.filter((name) =>
                    envServices.includes(name)
                );
                console.log(
                    `📌 Starting services from env: ${envServices.join(", ")}\n`
                );
            }
        } else {
            // Default: start only enabled services
            servicesToStart = enabledAndReadyServices;
            console.log(`📌 Default mode: Starting enabled services only`);
            console.log(
                `   💡 Enabled services: ${
                    enabledAndReadyServices.join(", ") || "none"
                }`
            );
            console.log(`   💡 To start all services: npm start -- all`);
            console.log(
                `   💡 To start specific services: npm start -- service-name`
            );
            console.log(
                `   💡 Configure enabled services in: config/service-enablement.config.js\n`
            );
        }

        console.log(
            `📋 Found ${readyServices.length} service(s), starting ${servicesToStart.length}`
        );

        if (servicesToStart.length === 0) {
            console.log("\n⚠️  No services to start.");
            if (cliArgs.length > 0 || envServices) {
                console.log(
                    "   The specified services were not found or are not ready."
                );
                console.log(
                    "   Available services: " + readyServices.join(", ")
                );
            } else {
                console.log(
                    "   Services need an index.js and package.json to be started."
                );
            }
            console.log();
            return;
        }

        console.log("🔧 Starting microservices...");

        // Start all ready services with staggered timing for cleaner output
        for (let i = 0; i < servicesToStart.length; i++) {
            const serviceName = servicesToStart[i];
            const port = SERVICE_PORTS[serviceName] || 3100;
            await startService(serviceName, port);

            // Small delay for output to settle
            if (i < servicesToStart.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 300));
            }
        }

        // Wait a bit before starting gateway
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Start API Gateway
        await startGateway();

        console.log("\n\n" + "═".repeat(50));
        console.log("✅  All services running!");
        console.log("═".repeat(50));
        console.log(`\n   🌐 API Gateway: http://localhost:${GATEWAY_PORT}`);
        console.log("   📊 Services: " + servicesToStart.length + " active");
        if (servicesToStart.length < readyServices.length) {
            console.log(
                "   ℹ️  " +
                    (readyServices.length - servicesToStart.length) +
                    " service(s) available but not started"
            );
        }
        console.log("\n   Press Ctrl+C to stop all services\n");
    } catch (error) {
        console.error("\n❌ Failed to start services:", error.message);
        shutdown();
    }
}

// Handle shutdown signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Don't call shutdown on exit as it causes issues
process.on("exit", () => {
    // Just ensure we're marked as shutting down
    shutdownInProgress = true;
});

// Handle unexpected termination
process.on("uncaughtException", (error) => {
    console.error("\n❌ Uncaught exception:", error.message);
    shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("\n❌ Unhandled rejection:", reason);
    shutdown();
});

// Start everything
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
