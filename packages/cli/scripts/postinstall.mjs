#!/usr/bin/env node
/**
 * thoxcode postinstall — prints a friendly welcome with next steps.
 *
 * Quiet by design: skips entirely when run in CI, when stdout is not a
 * TTY, when running in a Docker layer build, when the user installed
 * with --silent / --quiet, when the package is being installed as a
 * transitive dep, or when THOXCODE_DISABLE_POSTINSTALL is set.
 *
 * Never throws — postinstall failures must not break `npm install`.
 */

const env = process.env;

function shouldSkip() {
  if (env.THOXCODE_DISABLE_POSTINSTALL) return true;
  if (env.CI) return true;
  if (env.GITHUB_ACTIONS || env.GITLAB_CI || env.CIRCLECI || env.BUILDKITE) {
    return true;
  }
  // Don't run during Dockerfile builds.
  if (env.NODE_ENV === "production" && env.DOCKER_BUILD) return true;
  // Skip when installed as a transitive dep — only greet on direct install.
  // npm sets npm_config_global=true for `-g` installs. Local installs leave
  // INIT_CWD set to the consumer project. We greet in both cases.
  // npm_loglevel "silent"/"error" → user asked for quiet.
  const loglevel = (env.npm_config_loglevel ?? "").toLowerCase();
  if (loglevel === "silent" || loglevel === "error") return true;
  if (process.stdout.isTTY === false && !env.THOXCODE_FORCE_POSTINSTALL) {
    return true;
  }
  return false;
}

function color(code) {
  return process.stdout.isTTY ? `\x1b[${code}m` : "";
}
const reset = color("0");
const cyan = color("38;5;51");
const dim = color("2");
const bold = color("1");

function print() {
  const lines = [
    "",
    `${cyan}${bold}  ThoxCode${reset}${dim} · Powered by Claude${reset}`,
    `${dim}  Thox.ai's branded coding agent${reset}`,
    "",
    `  ${bold}Next steps:${reset}`,
    `  ${dim}1.${reset} Set your Anthropic API key:`,
    `       ${cyan}export ANTHROPIC_API_KEY=sk-ant-…${reset}`,
    `  ${dim}2.${reset} Try it:`,
    `       ${cyan}thoxcode "list the slowest tests in this project"${reset}`,
    `  ${dim}3.${reset} Tour the flags:`,
    `       ${cyan}thoxcode --help${reset}`,
    "",
    `  ${dim}Docs:    ${reset}https://github.com/ttracx/thoxcode#readme`,
    `  ${dim}Roadmap: ${reset}https://github.com/ttracx/thoxcode/blob/main/ROADMAP.md`,
    `  ${dim}Issues:  ${reset}https://github.com/ttracx/thoxcode/issues`,
    "",
    `  ${dim}(Silence this message: export THOXCODE_DISABLE_POSTINSTALL=1)${reset}`,
    "",
  ];
  console.log(lines.join("\n"));
}

try {
  if (!shouldSkip()) print();
} catch {
  // never break `npm install`
}
