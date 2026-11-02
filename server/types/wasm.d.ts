declare module "*.wasm" {
  const factory: () => unknown;
  export default factory;
}

declare module "*?module" {
  const mod: WebAssembly.Module;
  export default mod;
}
