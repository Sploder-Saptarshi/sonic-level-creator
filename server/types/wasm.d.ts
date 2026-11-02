// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

declare module "*.wasm" {
  const factory: () => unknown;
  export default factory;
}

declare module "*?module" {
  const mod: WebAssembly.Module;
  export default mod;
}
