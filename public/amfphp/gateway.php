<?php
// Offline PlaySEGA AMF0 gateway (amfphp/gateway.php).
// PHP equivalent of the reverse-engineered Python stub server.
// Handles both services that share this URL:
//   PlaySEGAAPI.*    (insertCoin, getNonce, levelUp, pauseGame, unPause,
//                     gameOver, getScores, getNumRings, getUsername, debit)
//   LevelEditorAPI.* (getLevel, publishLevel, saveLevel, ...)
// No dependencies, pure PHP.

const API_NONCE = 'playsega_offline';

// ---------------------------------------------------------------------------
// AMF0 reader
// ---------------------------------------------------------------------------
class Amf0Reader {
    public string $d;
    public int $p = 0;
    public function __construct(string $d) { $this->d = $d; }
    public function u8(): int { return ord($this->d[$this->p++]); }
    public function u16(): int {
        $v = unpack('n', $this->d, $this->p)[1];
        $this->p += 2;
        return $v;
    }
    public function u32(): int {
        $v = unpack('N', $this->d, $this->p)[1];
        $this->p += 4;
        return $v;
    }
    public function i32(): int {
        $v = unpack('l', strrev(substr($this->d, $this->p, 4)))[1];
        // unpack('N') is unsigned; convert manually for signed length
        $u = unpack('N', $this->d, $this->p)[1];
        $this->p += 4;
        return ($u >= 0x80000000) ? $u - 0x100000000 : $u;
    }
    public function f64(): float {
        $v = unpack('E', $this->d, $this->p)[1];
        $this->p += 8;
        return $v;
    }
    public function str(): string {
        $n = $this->u16();
        $s = substr($this->d, $this->p, $n);
        $this->p += $n;
        return $s;
    }
    public function longStr(): string {
        $n = $this->u32();
        $s = substr($this->d, $this->p, $n);
        $this->p += $n;
        return $s;
    }
    /** @return mixed */
    public function val() {
        $t = $this->u8();
        switch ($t) {
            case 0x00: return $this->f64();
            case 0x01: return (bool)$this->u8();
            case 0x02: return $this->str();
            case 0x03: return $this->obj(false);
            case 0x05: case 0x06: return null;
            case 0x08: $this->u32(); return $this->obj(true); // ECMA array count ignored
            case 0x0A: {
                $n = $this->u32();
                $a = [];
                for ($i = 0; $i < $n; $i++) $a[] = $this->val();
                return $a;
            }
            case 0x0B: { $v = $this->f64(); $this->u16(); return $v; } // date -> float
            case 0x0C: return $this->longStr();
            default: throw new Exception(sprintf('Unknown AMF0 type 0x%02x at %d', $t, $this->p - 1));
        }
    }
    private function obj(bool $ecma): array {
        $o = [];
        while (true) {
            if (strlen($this->d) - $this->p < 3) break;
            $klen = unpack('n', $this->d, $this->p)[1];
            if ($klen === 0 && ord($this->d[$this->p + 2]) === 0x09) { $this->p += 3; break; }
            $k = $this->str();
            $o[$k] = $this->val();
        }
        return $o;
    }
}

// ---------------------------------------------------------------------------
// AMF0 writer
// ---------------------------------------------------------------------------
function amf0_wstr(string $s): string {
    return pack('n', strlen($s)) . $s;
}
/** @param mixed $v */
function amf0_wval($v): string {
    if ($v === null) return "\x05";
    if (is_bool($v)) return "\x01" . chr($v ? 1 : 0);
    if (is_int($v) || is_float($v)) return "\x00" . pack('E', (float)$v);
    if (is_string($v)) {
        return (strlen($v) < 0x10000)
            ? "\x02" . pack('n', strlen($v)) . $v
            : "\x0c" . pack('N', strlen($v)) . $v;
    }
    if (is_array($v)) {
        if (array_is_list($v)) {
            $r = "\x0a" . pack('N', count($v));
            foreach ($v as $x) $r .= amf0_wval($x);
            return $r;
        }
        $r = "\x03";
        foreach ($v as $k => $x) $r .= amf0_wstr((string)$k) . amf0_wval($x);
        return $r . "\x00\x00\x09";
    }
    return "\x05";
}
function amf0_envelope(string $respId, $value): string {
    $body = amf0_wval($value);
    // single-message envelope; caller concatenates for batches
    return pack('nnn', 0, 0, 1)
        . amf0_wstr($respId . '/onResult') . amf0_wstr('')
        . pack('N', strlen($body)) . $body;
}

// ---------------------------------------------------------------------------
// Service implementation (mirrors the Python stub)
// ---------------------------------------------------------------------------
// Level sources: on-disk (pristine zone1 stock) vs future database rows.
// ---------------------------------------------------------------------------

// Directory holding the pristine zone1 (Green Hill) stock files. Editor saves
// overwrite the live copies under res/data/default/, so the on-disk path
// reads here instead — zone1 tiles, always.
const STOCK_DATA_DIR = '/../games/swf/52/res/data/stock';

// Level source selector. 'disk' serves the stock zone1 pair below; a future
// 'database' source will serve per-level rows and fall back to disk.
const LEVEL_SOURCE = 'disk';

/** @return string comma-separated decimal byte string (BIN+ACT) */
function level_bytes_from_disk(?string $levelId): string {
    // $levelId is reserved for per-level routing once the database path lands.
    // Today every level resolves to the zone1 stock pair.
    // onGetLevel feeds ONE ByteArray into parseBinFile (3D-int blockData)
    // immediately followed by parseActFile (4 shorts + byte tables), so a
    // BIN-only blob starves the ACT parser -> black screen. Concatenate.
    // onGetLevel expects a comma-separated decimal byte STRING
    // (Utilities.readStringArray does param.split(",")), not a strict array.
    static $cache = null;
    if ($cache === null) {
        $bin = @file_get_contents(__DIR__ . STOCK_DATA_DIR . '/mc_gh_map_data.bin');
        $act = @file_get_contents(__DIR__ . STOCK_DATA_DIR . '/ZONE1ACT.act');
        $raw = (is_string($bin) ? $bin : '') . (is_string($act) ? $act : '');
        $cache = $raw !== '' ? implode(',', unpack('C*', $raw)) : '';
    }
    return $cache;
}

/** @return ?string null until the database path is implemented */
function level_bytes_from_database(?string $levelId): ?string {
    return null;
}

/** @param mixed[] $args @return string */
function get_level_bytes(array $args): string {
    $levelId = (isset($args[0]) && is_string($args[0])) ? $args[0] : null;
    if (LEVEL_SOURCE === 'database') {
        $db = level_bytes_from_database($levelId);
        if ($db !== null && $db !== '') return $db;
    }
    // Regular path: on-disk zone1 tiles.
    return level_bytes_from_disk($levelId);
}

/** @param mixed[] $args @return mixed */
function playsega_call(string $method, array $args) {
    switch ($method) {
        case 'insertCoin':  return true;
        case 'getNonce':    return API_NONCE;
        case 'levelUp':     return 1;
        case 'pauseGame':   return true;
        case 'unPause':     return true;
        case 'gameOver':    return [];
        case 'getScores':   return '';
        case 'getNumRings': return 0;
        case 'getUsername': return 'Guest';
        case 'debit':       return true;
        case 'getLevel':    return get_level_bytes($args);
        default:            return null;
    }
}

// ---------------------------------------------------------------------------
// Request handling (POST only; static files are served by the web server)
// ---------------------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}
$raw = file_get_contents('php://input');
try {
    $r = new Amf0Reader($raw);
    $r->u16(); // version
    $hc = $r->u16();
    for ($i = 0; $i < $hc; $i++) { // skip headers
        $r->str();
        $r->u8();
        $len = $r->u32();
        $r->p += $len;
    }
    $mc = $r->u16();
    $out = '';
    for ($i = 0; $i < $mc; $i++) {
        $tgt  = $r->str();
        $resp = $r->str();
        $r->i32(); // body length, recomputed on encode
        $body = $r->val();
        $m = substr($tgt, strrpos($tgt, '.') + 1);
        $a = is_array($body) && array_is_list($body) ? $body : [$body];
        $out .= amf0_envelope($resp, playsega_call($m, $a));
    }
} catch (Throwable $e) {
    http_response_code(400);
    exit;
}
header('Content-Type: application/x-amf');
header('Content-Length: ' . strlen($out));
echo $out;
