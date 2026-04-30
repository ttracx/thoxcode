import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

interface QuantumServiceConfig {
  /** Base URL for the ThoxQuantum FastAPI service. Defaults to localhost:8200. */
  baseUrl: string;
  /** Optional auth header (e.g. "Bearer …") for managed deployments. */
  authHeader?: string;
}

async function quantumFetch(
  cfg: QuantumServiceConfig,
  path: string,
  body: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.authHeader) headers["authorization"] = cfg.authHeader;

  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`ThoxQuantum ${path} returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const runCircuitTool = (cfg: QuantumServiceConfig) =>
  tool(
    "thox_quantum_run_circuit",
    "Execute a quantum circuit on the ThoxQuantum runtime (cuStateVec/cuTensorNet on Jetson Orin or MagStack cluster). Use for ≤29 qubit statevector or larger tensor-network simulations.",
    {
      qasm: z
        .string()
        .describe("OpenQASM 2.0 source. Must declare qreg and creg."),
      backend: z
        .enum(["custatevec", "cutensornet", "pennylane_gpu", "numpy"])
        .default("custatevec")
        .describe("Backend selector. Default custatevec."),
      shots: z
        .number()
        .int()
        .positive()
        .default(1024)
        .describe("Number of measurement shots."),
    },
    async ({ qasm, backend, shots }) => {
      try {
        const result = (await quantumFetch(cfg, "/v1/circuits/run", {
          qasm,
          backend,
          shots,
        })) as { counts?: Record<string, number>; statevector?: number[] };
        return {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `ThoxQuantum error: ${msg}` }],
          isError: true,
        };
      }
    },
  );

const qubitCapacityTool = () =>
  tool(
    "thox_quantum_capacity",
    "Look up the maximum simulable qubit count for a given Thox device + backend. Static knowledge from NVIDIA cuQuantum benchmarks.",
    {
      device: z.enum([
        "orin_nx_16gb",
        "agx_orin_32gb",
        "agx_orin_64gb",
        "magstack_8x_nx",
      ]),
      backend: z.enum(["statevector_fp64", "statevector_fp32", "tensor_network", "density_matrix"]),
    },
    async ({ device, backend }) => {
      const table: Record<string, Record<string, string>> = {
        orin_nx_16gb: {
          statevector_fp64: "29 qubits",
          statevector_fp32: "30 qubits",
          tensor_network: "50–100 qubits (circuit-dependent)",
          density_matrix: "14 qubits",
        },
        agx_orin_32gb: {
          statevector_fp64: "30 qubits",
          statevector_fp32: "31 qubits",
          tensor_network: "80–120 qubits (circuit-dependent)",
          density_matrix: "15 qubits",
        },
        agx_orin_64gb: {
          statevector_fp64: "31 qubits",
          statevector_fp32: "32 qubits",
          tensor_network: "100+ qubits (circuit-dependent)",
          density_matrix: "15 qubits",
        },
        magstack_8x_nx: {
          statevector_fp64: "32 qubits (cusvaer, power-of-2 nodes)",
          statevector_fp32: "33 qubits (cusvaer, power-of-2 nodes)",
          tensor_network: "depends on contraction strategy",
          density_matrix: "n/a",
        },
      };
      const capacity = table[device]?.[backend] ?? "unknown";
      return {
        content: [
          {
            type: "text",
            text: `${device} / ${backend}: ${capacity}`,
          },
        ],
      };
    },
  );

/**
 * Build the in-process MCP server that exposes ThoxQuantum tools to the
 * agent. Pass the result to query() options.mcpServers.
 */
export function createThoxQuantumMcpServer(cfg: Partial<QuantumServiceConfig> = {}) {
  const resolved: QuantumServiceConfig = {
    baseUrl: cfg.baseUrl ?? process.env.THOX_QUANTUM_URL ?? "http://localhost:8200",
    ...(cfg.authHeader !== undefined ? { authHeader: cfg.authHeader } : {}),
  };
  return createSdkMcpServer({
    name: "thox-quantum",
    version: "0.1.0",
    tools: [runCircuitTool(resolved), qubitCapacityTool()],
  });
}
