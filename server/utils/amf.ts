// server/utils/amf.ts — minimal AMF0 gateway (Workers-safe, no deps).
// Direct port of public/amfphp/gateway.php: same envelope, same services,
// same reply shapes. Handles both services sharing the URL:
//   PlaySEGAAPI.*    (insertCoin, getNonce, levelUp, pauseGame, unPause,
//                     gameOver, getScores, getNumRings, getUsername, debit)
//   LevelEditorAPI.* (getLevel, ...)
// Level bytes come ONLY from the database (no disk reads): getLevel resolves
// a level id to its comma-decimal BIN+ACT string, '' when unknown/corrupt.

export type AmfValue =
  | null
  | boolean
  | number
  | string
  | AmfValue[]
  | { [k: string]: AmfValue };

const enc = new TextEncoder();
const dec = new TextDecoder();

class Reader {
  private v: DataView;
  p = 0;
  constructor(private d: Uint8Array) {
    this.v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  }
  u8(): number {
    return this.v.getUint8(this.p++);
  }
  u16(): number {
    const x = this.v.getUint16(this.p);
    this.p += 2;
    return x;
  }
  u32(): number {
    const x = this.v.getUint32(this.p);
    this.p += 4;
    return x;
  }
  i32(): number {
    const x = this.v.getInt32(this.p);
    this.p += 4;
    return x;
  }
  f64(): number {
    const x = this.v.getFloat64(this.p);
    this.p += 8;
    return x;
  }
  bytes(n: number): Uint8Array {
    if (this.p + n > this.d.length) throw new Error("amf overrun");
    const s = this.d.subarray(this.p, this.p + n);
    this.p += n;
    return s;
  }
  str(): string {
    return dec.decode(this.bytes(this.u16()));
  }
  longStr(): string {
    return dec.decode(this.bytes(this.u32()));
  }
  val(): AmfValue {
    const t = this.u8();
    switch (t) {
      case 0x00:
        return this.f64();
      case 0x01:
        return this.u8() !== 0;
      case 0x02:
        return this.str();
      case 0x03:
        return this.obj();
      case 0x05:
      case 0x06:
        return null;
      case 0x08:
        this.u32(); // ECMA array count, ignored
        return this.obj();
      case 0x0a: {
        const n = this.u32();
        const a: AmfValue[] = [];
        for (let i = 0; i < n; i++) a.push(this.val());
        return a;
      }
      case 0x0b:
        return this.f64(); // date -> float (mirrors PHP)
      case 0x0c:
        return this.longStr();
      default:
        throw new Error(`unknown AMF0 type 0x${t.toString(16)} at ${this.p - 1}`);
    }
  }
  private obj(): { [k: string]: AmfValue } {
    const o: { [k: string]: AmfValue } = {};
    for (;;) {
      if (this.d.length - this.p < 3) break;
      const klen = this.v.getUint16(this.p);
      if (klen === 0 && this.d[this.p + 2] === 0x09) {
        this.p += 3;
        break;
      }
      o[this.str()] = this.val();
    }
    return o;
  }
}

function wstr(s: string): number[] {
  const b = Array.from(enc.encode(s));
  return [(b.length >>> 8) & 0xff, b.length & 0xff, ...b];
}

function wval(v: AmfValue): number[] {
  if (v === null) return [0x05];
  if (typeof v === "boolean") return [0x01, v ? 1 : 0];
  if (typeof v === "number") {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v);
    return [0x00, ...b];
  }
  if (typeof v === "string") {
    const b = Array.from(enc.encode(v));
    return b.length < 0x10000
      ? [0x02, (b.length >>> 8) & 0xff, b.length & 0xff, ...b]
      : [0x0c, (b.length >>> 24) & 0xff, (b.length >>> 16) & 0xff,
        (b.length >>> 8) & 0xff, b.length & 0xff, ...b];
  }
  if (Array.isArray(v)) {
    const out = [0x0a, (v.length >>> 24) & 0xff, (v.length >>> 16) & 0xff,
      (v.length >>> 8) & 0xff, v.length & 0xff];
    for (const x of v) out.push(...wval(x));
    return out;
  }
  const out = [0x03];
  for (const [k, x] of Object.entries(v)) out.push(...wstr(k), ...wval(x));
  return [...out, 0x00, 0x00, 0x09];
}

function envelope(respId: string, value: AmfValue): number[] {
  const body = wval(value);
  const len = body.length;
  return [
    0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ...wstr(`${respId}/onResult`), ...wstr(""),
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...body,
  ];
}

export const API_NONCE = "playsega_offline";

// One AMF0 POST body -> reply bytes. getLevelBytes maps a level id string
// (or null) to its game byte string; '' serves unknown/corrupt ids.
export async function handleAmf(
  raw: Uint8Array,
  getLevelBytes: (levelId: string | null) => Promise<string>,
): Promise<Uint8Array> {
  const r = new Reader(raw);
  r.u16(); // version
  const hc = r.u16();
  for (let i = 0; i < hc; i++) {
    r.str();
    r.u8();
    r.p += r.u32();
  }
  const mc = r.u16();
  const out: number[] = [];
  for (let i = 0; i < mc; i++) {
    const tgt = r.str();
    const resp = r.str();
    r.i32(); // body length, recomputed on encode
    const body = r.val();
    const method = tgt.slice(tgt.lastIndexOf(".") + 1);
    const args = Array.isArray(body) ? body : [body];
    out.push(...envelope(resp, await playsegaCall(method, args, getLevelBytes)));
  }
  return new Uint8Array(out);
}

async function playsegaCall(
  method: string,
  args: AmfValue[],
  getLevelBytes: (levelId: string | null) => Promise<string>,
): Promise<AmfValue> {
  switch (method) {
    case "insertCoin":
      return true;
    case "getNonce":
      return API_NONCE;
    case "levelUp":
      return 1;
    case "pauseGame":
      return true;
    case "unPause":
      return true;
    case "gameOver":
      return [];
    case "getScores":
      return "";
    case "getNumRings":
      return 0;
    case "getUsername":
      return "Guest";
    case "debit":
      return true;
    case "getLevel": {
      const id = typeof args[0] === "string" ? args[0] : null;
      return getLevelBytes(id);
    }
    default:
      return null;
  }
}
