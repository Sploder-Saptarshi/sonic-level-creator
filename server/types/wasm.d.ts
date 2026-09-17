// Bare `.wasm` imports: Nitro inlines them into the server bundle as
// factories returning the live, pre-instantiated exports object.
declare module "*.wasm" {
  const factory: () => unknown;
  export default factory;
}

// `?module` imports: real WebAssembly.Module objects on every preset —
// the only Workers-legal way to load WASM (runtime compile is blocked).
declare module "*?module" {
  const mod: WebAssembly.Module;
  export default mod;
}
