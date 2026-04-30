import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Sandbox } from "@vercel/sandbox";

const TRUNCATE_BYTES = 64 * 1024;

function truncate(text: string): string {
  if (text.length <= TRUNCATE_BYTES) return text;
  return (
    text.slice(0, TRUNCATE_BYTES) +
    `\n\n…[truncated ${text.length - TRUNCATE_BYTES} bytes]`
  );
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function err(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const bashTool = (sandbox: Sandbox) =>
  tool(
    "sandbox_bash",
    "Run a shell command inside the ThoxCode sandbox (Amazon Linux 2023, sudo available). Use for file inspection, package installs, builds, and tests. Output is captured (stdout + stderr).",
    {
      command: z.string().describe("Shell command line. Run via bash -lc."),
      cwd: z
        .string()
        .optional()
        .describe("Working directory. Defaults to /vercel/sandbox."),
      timeoutSec: z
        .number()
        .int()
        .positive()
        .max(600)
        .optional()
        .describe("Per-command timeout in seconds. Default 120."),
    },
    async ({ command, cwd, timeoutSec }) => {
      const ac = new AbortController();
      const timer = setTimeout(
        () => ac.abort(),
        (timeoutSec ?? 120) * 1000,
      );
      try {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: ["-lc", command],
          ...(cwd !== undefined ? { cwd } : {}),
          signal: ac.signal,
        });
        const combined = await result.output("both");
        const status = result.exitCode === 0 ? "OK" : `exit ${result.exitCode}`;
        return ok(`[${status}]\n${truncate(combined)}`);
      } catch (e) {
        return err(
          `sandbox_bash failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  );

const readFileTool = (sandbox: Sandbox) =>
  tool(
    "sandbox_read",
    "Read a UTF-8 text file from the sandbox. Returns content (truncated at 64 KB).",
    {
      path: z.string().describe("Path inside sandbox. Default cwd /vercel/sandbox."),
    },
    async ({ path }) => {
      try {
        const buf = await sandbox.readFileToBuffer({ path });
        if (buf === null) return err(`File not found: ${path}`);
        return ok(truncate(buf.toString("utf8")));
      } catch (e) {
        return err(
          `sandbox_read failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

const writeFileTool = (sandbox: Sandbox) =>
  tool(
    "sandbox_write",
    "Create or overwrite a UTF-8 text file in the sandbox. Use sandbox_edit for surgical changes to existing files.",
    {
      path: z.string().describe("Path inside sandbox."),
      content: z.string().describe("Full file contents."),
      mode: z
        .number()
        .int()
        .optional()
        .describe("Optional Unix file mode in octal, e.g. 0o755 for executable."),
    },
    async ({ path, content, mode }) => {
      try {
        await sandbox.writeFiles([
          {
            path,
            content: Buffer.from(content, "utf8"),
            ...(mode !== undefined ? { mode } : {}),
          },
        ]);
        return ok(`Wrote ${content.length} bytes to ${path}`);
      } catch (e) {
        return err(
          `sandbox_write failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

const editFileTool = (sandbox: Sandbox) =>
  tool(
    "sandbox_edit",
    "Replace a unique string in a sandbox file. Errors if oldString is not found or appears multiple times. Use sandbox_write for whole-file replacement.",
    {
      path: z.string(),
      oldString: z.string().describe("Exact string to replace. Must be unique."),
      newString: z.string(),
    },
    async ({ path, oldString, newString }) => {
      try {
        const buf = await sandbox.readFileToBuffer({ path });
        if (buf === null) return err(`File not found: ${path}`);
        const original = buf.toString("utf8");
        const occurrences = original.split(oldString).length - 1;
        if (occurrences === 0) {
          return err("oldString not found in file");
        }
        if (occurrences > 1) {
          return err(
            `oldString appears ${occurrences} times — must be unique. Add surrounding context.`,
          );
        }
        const updated = original.replace(oldString, newString);
        await sandbox.writeFiles([
          { path, content: Buffer.from(updated, "utf8") },
        ]);
        return ok(`Edited ${path} (1 replacement)`);
      } catch (e) {
        return err(
          `sandbox_edit failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

const lsTool = (sandbox: Sandbox) =>
  tool(
    "sandbox_ls",
    "List directory contents in the sandbox.",
    {
      path: z.string().default(".").describe("Directory path. Default '.' (cwd)."),
    },
    async ({ path }) => {
      try {
        const result = await sandbox.runCommand({
          cmd: "bash",
          args: ["-lc", `ls -la --color=never ${JSON.stringify(path)}`],
        });
        if (result.exitCode !== 0) {
          return err(await result.stderr());
        }
        return ok(truncate(await result.stdout()));
      } catch (e) {
        return err(
          `sandbox_ls failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

const previewUrlTool = (sandbox: Sandbox) =>
  tool(
    "sandbox_preview_url",
    "Get the public preview URL for a port that was exposed when the sandbox was created. Use after starting a dev server.",
    {
      port: z.number().int().positive(),
    },
    async ({ port }) => {
      try {
        return ok(sandbox.domain(port));
      } catch (e) {
        return err(
          `sandbox_preview_url failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );

/**
 * Build the in-process MCP server that gives the agent sandboxed tools.
 * Pair with `disallowedTools: ["Bash","Read","Write","Edit","Glob","Grep","WebFetch"]`
 * on the runtime so the agent uses these instead of the host-execution
 * built-ins.
 */
export function createSandboxToolServer(sandbox: Sandbox) {
  return createSdkMcpServer({
    name: "thox-sandbox",
    version: "0.1.0",
    tools: [
      bashTool(sandbox),
      readFileTool(sandbox),
      writeFileTool(sandbox),
      editFileTool(sandbox),
      lsTool(sandbox),
      previewUrlTool(sandbox),
    ],
  });
}

export const SANDBOX_TOOL_NAMES = [
  "mcp__thox-sandbox__sandbox_bash",
  "mcp__thox-sandbox__sandbox_read",
  "mcp__thox-sandbox__sandbox_write",
  "mcp__thox-sandbox__sandbox_edit",
  "mcp__thox-sandbox__sandbox_ls",
  "mcp__thox-sandbox__sandbox_preview_url",
];

export const HOST_TOOLS_TO_DISALLOW = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "Monitor",
];
