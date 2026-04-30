import kleur from "kleur";

/**
 * Thox-native ASCII logo. Deliberately distinct from Claude Code's
 * chrome per Anthropic's Agent SDK branding guidelines:
 * https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines
 *
 * The "THOX" wordmark uses upper-half/lower-half block characters
 * (pseudo-pixel font, ~7 columns per glyph). The interior dot is the
 * Thox quantum motif.
 */
const THOX_LOGO_LINES = [
  "▀█▀ █▄█ █▀█ ▀▄▀     █▀▀ █▀█ █▀▄ █▀▀",
  " █  █ █ █▄█ █ █  ◇  █▄▄ █▄█ █▄▀ ██▄",
];

const ASCII_FALLBACK_LINES = [
  "+--------+ +--------+",
  "|  THOX  |-|  CODE  |",
  "+--------+ +--------+",
];

const NO_COLOR =
  process.env.NO_COLOR !== undefined ||
  process.env.THOXCODE_NO_COLOR !== undefined;

function isUtf8Capable(): boolean {
  if (process.env.THOXCODE_FORCE_ASCII) return false;
  const lc = (
    process.env.LC_ALL ??
    process.env.LC_CTYPE ??
    process.env.LANG ??
    ""
  ).toLowerCase();
  if (lc.includes("utf-8") || lc.includes("utf8")) return true;
  // Default to UTF-8 on modern terminals; the env-var check above catches
  // legacy POSIX locales where the unicode glyphs would render as ?.
  return process.stdout.isTTY === true;
}

export interface BannerOptions {
  /** When true, return a plain string with no ANSI color codes. */
  noColor?: boolean;
  /** Override version shown in the bigBanner. */
  version?: string;
}

/**
 * Multi-line wordmark + tagline shown on `--help`, `--version`, and at
 * the start of an agent run (unless --no-banner / THOXCODE_NO_BANNER).
 */
export function bigBanner(opts: BannerOptions = {}): string {
  const useColor = !(opts.noColor ?? NO_COLOR);
  const utf8 = isUtf8Capable();

  const cyan = (s: string) => (useColor ? kleur.cyan().bold(s) : s);
  const accent = (s: string) => (useColor ? kleur.magenta(s) : s);
  const dim = (s: string) => (useColor ? kleur.dim(s) : s);

  const lines = utf8 ? THOX_LOGO_LINES : ASCII_FALLBACK_LINES;

  // Tagline: "THOX.ai · Powered by Claude"
  // Version is intentionally omitted — `thoxcode --version` exposes it.
  // "Powered by Claude" attribution stays per Anthropic Agent SDK terms.
  const tagline = [
    cyan("THOX.ai"),
    dim("·"),
    accent("Powered by Claude"),
  ].join(" ");

  return [
    "",
    "  " + cyan(lines[0] ?? ""),
    "  " + cyan(lines[1] ?? ""),
    ...(lines[2] ? ["  " + cyan(lines[2])] : []),
    "  " + tagline,
    "",
  ].join("\n");
}

/**
 * Single-line variant. Used in the compact end-of-session line and in
 * scripts where a 5-line logo would be excessive.
 */
export function compactBanner(opts: BannerOptions = {}): string {
  const useColor = !(opts.noColor ?? NO_COLOR);
  const cyan = (s: string) => (useColor ? kleur.cyan().bold(s) : s);
  const accent = (s: string) => (useColor ? kleur.magenta(s) : s);
  const dim = (s: string) => (useColor ? kleur.dim(s) : s);
  const sep = dim("·");
  const v = opts.version ? ` ${sep} ${dim(`v${opts.version}`)}` : "";
  return `${cyan("◇ ThoxCode")} ${sep} ${accent("Powered by Claude")}${v}`;
}

/** Back-compat alias used by other call sites. */
export const banner = bigBanner;
