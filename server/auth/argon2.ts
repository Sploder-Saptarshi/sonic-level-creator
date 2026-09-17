// server/auth/argon2.ts — Argon2id password hashing for Workers + Node.
//
// Thin wrapper over argon2-wasm-edge. The WASM binaries are imported with
// the `?module` convention, which yields real WebAssembly.Module objects
// through the Nitro build on every preset — the only Workers-legal way to
// load WASM (runtime compile from bytes is blocked by the embedder).
// Output is the standard PHC encoded string (params + salt embedded).
import { argon2id, argon2Verify, setWASMModules } from "argon2-wasm-edge";
import argon2WASM from "argon2-wasm-edge/wasm/argon2.wasm?module";
import blake2bWASM from "argon2-wasm-edge/wasm/blake2b.wasm?module";

setWASMModules({
  argon2WASM: argon2WASM as unknown as WebAssembly.Module,
  blake2bWASM: blake2bWASM as unknown as WebAssembly.Module,
});

export const ARGON2_PARAMS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 8192, // KiB (8 MiB) — signup/login only, never per-request
  hashLength: 32,
} as const;

// better-auth password hooks + general use.
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return (await argon2id({
    password,
    salt,
    ...ARGON2_PARAMS,
    outputType: "encoded",
  })) as string;
}

export async function verifyPassword(data: {
  password: string;
  hash: string;
}): Promise<boolean> {
  return argon2Verify(data);
}
