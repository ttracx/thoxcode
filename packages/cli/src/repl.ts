import readline from "node:readline";
import kleur from "kleur";
import {
  runInteractive,
  type AuthContext,
  type ThoxEvent,
} from "thoxcode-core";

export interface ReplOptions {
  auth: AuthContext;
  cwd: string;
  version: string;
}

const SLASH_HELP = [
  ["/help, /?", "Show available commands"],
  ["/clear", "Clear screen and start a fresh chat"],
  ["/cwd", "Print the agent's working directory"],
  ["/exit, /quit, /q", "Exit thoxcode"],
] as const;

/**
 * Multi-turn chat REPL. Returns a process exit code.
 *
 * UX:
 *   - Each line you type becomes a user message in a single Agent SDK
 *     streaming-input session, so context is preserved across turns.
 *   - Ctrl+C while the agent is thinking → cancels the current turn.
 *   - Ctrl+C at the prompt (twice) or Ctrl+D → exits cleanly.
 *   - Lines starting with `/` are slash commands handled locally.
 */
export async function runRepl(opts: ReplOptions): Promise<number> {
  // The REPL defaults to bypassPermissions: without a canUseTool callback,
  // any other mode would silently hang on the first Bash invocation. This
  // is documented in the welcome panel so the user knows. Implementing a
  // real interactive permission prompt is a v0.2 follow-up.
  const session = runInteractive({
    auth: opts.auth,
    cwd: opts.cwd,
    permissionMode: "bypassPermissions",
    allowedTools: ["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: kleur.cyan().bold("▸ "),
  });

  // Don't let Ctrl+C kill the process; we handle it.
  // (readline.createInterface installs its own SIGINT listener; we override.)

  let busy = false; // true between send() and the next 'result'/'error' event
  let exitArmed = false; // double-Ctrl+C exit guard at idle prompt
  let streamingActive = false; // any deltas printed since last assistant_text
  let shuttingDown = false; // true after /exit, Ctrl+D, or double-Ctrl+C

  function beginShutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    session.close();
    rl.close();
  }

  rl.on("SIGINT", () => {
    if (busy) {
      console.log(kleur.yellow("\n[interrupt] cancelling current turn…"));
      void session.interrupt();
      return;
    }
    if (exitArmed) {
      console.log(kleur.dim("bye."));
      beginShutdown();
      return;
    }
    exitArmed = true;
    process.stdout.write(
      "\n" + kleur.dim("(press Ctrl+C again to exit, or type /exit)") + "\n",
    );
    rl.prompt();
    setTimeout(() => {
      exitArmed = false;
    }, 1500);
  });

  rl.on("close", () => {
    // Ctrl+D / programmatic close → tear down session cleanly.
    if (!shuttingDown) {
      shuttingDown = true;
      session.close();
    }
  });

  printWelcome(opts);
  rl.prompt();

  // Pump readline lines into the session in the background.
  const inputPump = (async () => {
    try {
      for await (const lineRaw of rl) {
        if (shuttingDown) return;
        const line = lineRaw.trim();
        if (!line) {
          if (!busy) rl.prompt();
          continue;
        }

        if (line.startsWith("/")) {
          const handled = await handleSlash(line, opts, beginShutdown);
          if (handled === "exit") return;
          if (!busy) rl.prompt();
          continue;
        }

        // Echo nothing extra — readline already showed the user's input.
        busy = true;
        streamingActive = false;
        session.send(line);
      }
    } catch {
      // rl async iterator throws if rl.close() races the iteration;
      // shutdown path already handled, swallow.
    }
  })();

  // Render events as they arrive from the agent.
  for await (const event of session.events) {
    // Suppress the synthetic "aborted by user" error that the SDK emits
    // when we tear down via /exit, Ctrl+D, or double-Ctrl+C.
    if (shuttingDown && event.type === "error") continue;
    streamingActive = renderEvent(event, streamingActive);
    if (event.type === "result" || event.type === "error") {
      busy = false;
      exitArmed = false;
      streamingActive = false;
      if (!shuttingDown) rl.prompt();
    }
  }

  // event stream ended — make sure input pump unwinds.
  if (!shuttingDown) {
    shuttingDown = true;
    rl.close();
  }
  await inputPump;
  return 0;
}

function printWelcome(opts: ReplOptions): void {
  const cyan = kleur.cyan().bold;
  const dim = kleur.dim;
  const acc = kleur.magenta;
  console.log("");
  console.log(`  ${cyan("THOX.ai")} ${dim("·")} ${acc("interactive chat")} ${dim(`· v${opts.version}`)}`);
  console.log(`  ${dim("type /help for commands · /exit to quit · Ctrl+C cancels a turn")}`);
  console.log(
    `  ${dim("permissions:")} ${kleur.yellow("bypass")} ${dim("(REPL default — agent runs Bash/Edit without prompting)")}`,
  );
  console.log(`  ${dim("cwd:")} ${dim(opts.cwd)}`);
  console.log("");
}

async function handleSlash(
  line: string,
  opts: ReplOptions,
  exit: () => void,
): Promise<"exit" | "ok"> {
  const [cmdRaw] = line.slice(1).split(/\s+/);
  const cmd = (cmdRaw ?? "").toLowerCase();
  switch (cmd) {
    case "exit":
    case "quit":
    case "q":
      console.log(kleur.dim("bye."));
      exit();
      return "exit";
    case "help":
    case "?":
      printSlashHelp();
      return "ok";
    case "clear":
    case "cls":
      process.stdout.write("\x1b[2J\x1b[H");
      printWelcome(opts);
      return "ok";
    case "cwd":
      console.log(kleur.dim(opts.cwd));
      return "ok";
    default:
      console.log(kleur.dim(`unknown command: /${cmdRaw} — try /help`));
      return "ok";
  }
}

function printSlashHelp(): void {
  console.log("");
  console.log(kleur.bold("  Slash commands:"));
  for (const [name, desc] of SLASH_HELP) {
    console.log(`  ${kleur.cyan(name.padEnd(20))} ${kleur.dim(desc)}`);
  }
  console.log("");
}

/**
 * Render a single event to the terminal. Returns the new value for the
 * "streamingActive" flag so the caller can track whether deltas are
 * mid-flight (and we should write a closing newline on the next
 * assistant_text instead of re-printing the full text).
 */
function renderEvent(ev: ThoxEvent, streaming: boolean): boolean {
  switch (ev.type) {
    case "session_start":
      console.log(
        kleur.dim(`· session ${ev.sessionId.slice(0, 8)} · ${ev.model}`),
      );
      return streaming;
    case "assistant_text_delta":
      process.stdout.write(ev.text);
      return true;
    case "assistant_text":
      if (streaming) {
        // The deltas already painted this block inline; just close the line.
        process.stdout.write("\n");
        return false;
      }
      // No deltas arrived (deltas disabled, or non-streaming block) — paint
      // the full block now.
      console.log(ev.text);
      return false;
    case "thinking":
      console.log(
        kleur.dim().italic(`thinking… ${ev.text.slice(0, 80)}`),
      );
      return streaming;
    case "tool_call":
      console.log(
        kleur.cyan(`→ ${ev.tool}`) + " " + kleur.dim(jsonOneLine(ev.input)),
      );
      return streaming;
    case "tool_result": {
      const head = ev.ok ? kleur.green("✓") : kleur.red("✗");
      const out = ev.output.split("\n").slice(0, 6).join("\n");
      console.log(`${head} ${kleur.dim(out)}`);
      return streaming;
    }
    case "result":
      console.log(
        kleur.dim(
          `· done in ${(ev.durationMs / 1000).toFixed(1)}s · $${ev.costUsd.toFixed(4)}`,
        ),
      );
      return false;
    case "error":
      console.log(kleur.red(`error: ${ev.message}`));
      return false;
    default:
      return streaming;
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
