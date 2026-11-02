// Workers can only load WASM through `?module` imports.
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
  memorySize: 8192, // KiB (8 MiB); runs only on sign-up and sign-in
  hashLength: 32,
} as const;

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
