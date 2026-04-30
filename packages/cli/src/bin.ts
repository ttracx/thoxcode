#!/usr/bin/env node
import { runAgent, resolveAuth, ThoxAuthError } from "@thoxcode/core";
import type { ThoxEvent } from "@thoxcode/core";
import { runViaDaemon } from "@thoxcode/daemon";
import kleur from "kleur";
import { banner } from "./banner.js";

interface CliArgs {
  prompt: string;
  cwd: string;
  yolo: boolean;
  thoxos: boolean;
  socket?: string;
  showHelp: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    prompt: "",
    cwd: process.cwd(),
    yolo: false,
    thoxos: false,
    showHelp: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--help" || a === "-h") args.showHelp = true;
    else if (a === "--yolo") args.yolo = true;
    else if (a === "--thoxos") args.thoxos = true;
    else if (a === "--cwd") {
      const next = argv[i + 1];
      if (next !== undefined) {
        args.cwd = next;
        i++;
      }
    } else if (a === "--socket") {
      const next = argv[i + 1];
      if (next !== undefined) {
        args.socket = next;
        i++;
      }
    } else positional.push(a);
  }
  args.prompt = positional.join(" ").trim();
  return args;
}

function help() {
  console.log(banner());
  console.log("");
  console.log(kleur.bold("Usage:"));
  console.log("  thoxcode <prompt>            Run a one-shot task (in-process)");
  console.log("  thoxcode --thoxos <prompt>   Run via the local thoxcoded socket");
  console.log("  thoxcode --socket <path>     Override daemon socket path");
  console.log("  thoxcode --cwd <dir> ...     Override working directory");
  console.log("  thoxcode --yolo ...          Auto-accept edits (acceptEdits)");
  console.log("");
  console.log(kleur.bold("Auth:"));
  console.log("  Set ANTHROPIC_API_KEY in your shell. ThoxCode passes it");
  console.log("  through to Claude as a BYOK key — never logged or persisted.");
  console.log("");
}

function format(event: ThoxEvent): string | null {
  switch (event.type) {
    case "session_start":
      return kleur.dim(
        `· session ${event.sessionId.slice(0, 8)} · ${event.model}`,
      );
    case "assistant_text":
      if (event.text.startsWith("__THINKING__:")) {
        return kleur.dim().italic(`thinking… ${event.text.slice(13).slice(0, 80)}`);
      }
      return event.text;
    case "tool_call":
      return kleur.cyan(`→ ${event.tool}`) + " " + kleur.dim(jsonOneLine(event.input));
    case "tool_result": {
      const head = event.ok ? kleur.green("✓") : kleur.red("✗");
      const out = event.output.split("\n").slice(0, 6).join("\n");
      return `${head} ${kleur.dim(out)}`;
    }
    case "result":
      return kleur.dim(
        `· done in ${(event.durationMs / 1000).toFixed(1)}s · $${event.costUsd.toFixed(4)}`,
      );
    case "error":
      return kleur.red(`error: ${event.message}`);
    default:
      return null;
  }
}

function jsonOneLine(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? s.slice(0, 197) + "…" : s;
  } catch {
    return String(v);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.showHelp || !args.prompt) {
    help();
    process.exit(args.showHelp ? 0 : 1);
  }

  console.log(banner());
  console.log("");

  const ac = new AbortController();
  process.on("SIGINT", () => {
    console.log(kleur.yellow("\n[interrupt] cancelling…"));
    ac.abort();
  });

  const stream = args.thoxos
    ? runViaDaemon({
        prompt: args.prompt,
        cwd: args.cwd,
        yolo: args.yolo,
        ...(args.socket !== undefined ? { socketPath: args.socket } : {}),
        ...(process.env.ANTHROPIC_API_KEY
          ? { apiKey: process.env.ANTHROPIC_API_KEY }
          : {}),
        signal: ac.signal,
      })
    : (() => {
        let auth;
        try {
          auth = resolveAuth({ byokKey: process.env.ANTHROPIC_API_KEY });
        } catch (e) {
          if (e instanceof ThoxAuthError) {
            console.error(kleur.red(`[auth] ${e.message}`));
            console.error(
              kleur.dim("Set ANTHROPIC_API_KEY or use --thoxos with a configured daemon."),
            );
            process.exit(2);
          }
          throw e;
        }
        return runAgent({
          prompt: args.prompt,
          auth,
          cwd: args.cwd,
          permissionMode: args.yolo ? "acceptEdits" : "default",
          allowedTools: ["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
          signal: ac.signal,
        });
      })();

  for await (const event of stream) {
    const line = format(event);
    if (line !== null) console.log(line);
  }
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(kleur.red(`[fatal] ${msg}`));
  process.exit(1);
});
