interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

declare module "*.wasm" {
  const wasm: WebAssembly.Module;
  export default wasm;
}
declare module "*.wasm?arraybuffer" {
  const buf: ArrayBuffer;
  export default buf;
}
declare module "*.wasm?url" {
  const url: string;
  export default url;
}
