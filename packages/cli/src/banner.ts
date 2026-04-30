import kleur from "kleur";

// Thox-native chrome — deliberately distinct from Claude Code.
// Nova Space Gray (240) base, Quantum Cyan (51) accents.
export function banner(): string {
  const gray = (s: string) => kleur.gray(s);
  const cyan = (s: string) => kleur.cyan().bold(s);
  const dim = (s: string) => kleur.dim(s);
  const lines = [
    gray("┌─────────────────────────────────────────────┐"),
    gray("│  ") + cyan("ThoxCode") + dim("  ·  Powered by Claude") + gray("           │"),
    gray("│  ") + dim("Thox.ai edge AI · ThoxQuantum runtime") + gray("      │"),
    gray("└─────────────────────────────────────────────┘"),
  ];
  return lines.join("\n");
}
