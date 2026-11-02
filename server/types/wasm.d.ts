// Bare `.wasm` imports: factories returning pre-instantiated exports.
declare module "*.wasm" {
  const factory: () => unknown;
  export default factory;
}

// `?module` imports: real WebAssembly.Module objects (Workers-legal).
declare module "*?module" {
  const mod: WebAssembly.Module;
  export default mod;
}
