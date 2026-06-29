import { exec } from "child_process";
import chalk from "chalk";
import { log, printBanner } from "../utils/logger.js";

/**
 * `rudder overlay` — Open the ambient voice assistant overlay.
 * 
 * Attempts to launch Chrome in frameless app mode for a native widget feel.
 * Fallbacks to default browser open on other platforms.
 */
export async function overlayCommand() {
  printBanner();
  log.info("Launching Sovereign Voice Assistant Overlay...");
  log.br();

  const url = "http://localhost:3000/overlay";
  
  if (process.platform === "darwin") {
    // Attempt Chrome frameless app window first for premium feel
    const chromeAppCmd = `open -a "Google Chrome" --args --app="${url}" --window-size=480,420`;
    
    exec(chromeAppCmd, (error) => {
      if (error) {
        // Fallback to default open
        exec(`open "${url}"`);
      }
    });
  } else if (process.platform === "win32") {
    exec(`start ${url}`);
  } else {
    exec(`xdg-open ${url}`);
  }

  log.info(`${chalk.green("🚀 Overlay opened successfully!")}`);
  log.br();
  log.info(chalk.bold("How to bind to a Global macOS Hotkey (Option + Space):"));
  log.info(`1. Open the ${chalk.cyan("Shortcuts")} app on your Mac.`);
  log.info(`2. Create a new Shortcut, search for ${chalk.cyan("Run Shell Script")}, and paste:`);
  log.info(`   ${chalk.yellow(`/Users/tars2026/Developer/rudder-public/rudder overlay`)}`);
  log.info(`3. In the right panel under Shortcut Details, check ${chalk.cyan("Use as Quick Action")}.`);
  log.info(`4. Click ${chalk.cyan("Add Keyboard Shortcut")} and press ${chalk.green("Option + Space")}.`);
}
