import { defineConfig, type Plugin } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Vitest can't natively handle .wasm or binary asset imports (?arraybuffer, ?url
// for wasm). This stub plugin resolves those imports to inert values so modules
// that use them can be loaded (and their tests skipped) without crashing.
function wasmStubPlugin(): Plugin {
  return {
    name: "vitest-wasm-stub",
    resolveId(id) {
      if (id.endsWith(".wasm") || id.includes(".wasm?")) return `\0wasm-stub:${id}`;
    },
    load(id) {
      if (id.startsWith("\0wasm-stub:")) {
        if (id.includes("?url")) return `export default ""`;
        // ?arraybuffer or bare .wasm → empty ArrayBuffer
        return `export default new ArrayBuffer(0)`;
      }
    },
  };
}

export default defineConfig({
  plugins: [tsconfigPaths(), wasmStubPlugin()],
  test: {
    globals: true,
  },
});
