import chalk from "chalk";

const timestamp = () => {
  const d = new Date();
  return d.toLocaleTimeString("en-US", { hour12: false });
};

export const log = {
  info: (msg: string) =>
    console.log(`${chalk.dim(timestamp())} ${chalk.blue("INFO")}  ${msg}`),
  success: (msg: string) =>
    console.log(`${chalk.dim(timestamp())} ${chalk.green("✔")}     ${msg}`),
  warn: (msg: string) =>
    console.log(`${chalk.dim(timestamp())} ${chalk.yellow("WARN")}  ${msg}`),
  error: (msg: string) =>
    console.log(`${chalk.dim(timestamp())} ${chalk.red("ERROR")} ${msg}`),
  debug: (msg: string) => {
    if (process.env.RUDDER_DEBUG === "1") {
      console.log(`${chalk.dim(timestamp())} ${chalk.gray("DEBUG")} ${msg}`);
    }
  },
  /** Blank line */
  br: () => console.log(""),
  /** Section header */
  section: (title: string) => {
    console.log("");
    console.log(chalk.bold.white(`── ${title} ──`));
  },
  /** Key-value pair */
  kv: (key: string, value: string | number, color?: string) => {
    const colorFn = color === "green" ? chalk.green
      : color === "yellow" ? chalk.yellow
      : color === "red" ? chalk.red
      : color === "blue" ? chalk.blue
      : chalk.white;
    console.log(`   ${chalk.dim(key.padEnd(22))} ${colorFn(String(value))}`);
  },
};

/** The Rudder banner */
export function printBanner() {
  console.log(chalk.green.bold(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   ██████  ██    ██ ██████  ██████  ███   ║
  ║   ██   ██ ██    ██ ██   ██ ██   ██ ██    ║
  ║   ██████  ██    ██ ██   ██ ██   ██ ██    ║
  ║   ██   ██ ██    ██ ██   ██ ██   ██ ██    ║
  ║   ██   ██  ██████  ██████  ██████  ███   ║
  ║                                          ║
  ║   Sovereign Life Operating System        ║
  ╚══════════════════════════════════════════╝`));
  console.log("");
}
