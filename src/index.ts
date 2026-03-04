import { runCli } from "./cli/args";

async function main(): Promise<void> {
  await runCli(process.argv);
}

void main();
