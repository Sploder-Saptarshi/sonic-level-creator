<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST required']);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === '' || $raw === false) {
    echo json_encode(['ok' => false, 'error' => 'empty body']);
    exit;
}

// Strict charset validation using strspn (NOT regex — PCRE backtracking chokes past ~4500 groups)
$len = strlen($raw);
$valid = strspn($raw, '0123456789,');
if ($valid !== $len) {
    $bad = ord($raw[$valid]);
    echo json_encode(['ok' => false, 'error' => "invalid char '$raw[$valid]' (0x".dechex($bad).") at offset $valid"]);
    exit;
}

// Split on commas, validate each is an integer 0–255
$parts = explode(',', $raw);
$n = count($parts);
$bytes = new SplFixedArray($n);
for ($i = 0; $i < $n; $i++) {
    $v = (int)$parts[$i];
    if ($v < 0 || $v > 255 || $parts[$i] !== (string)$v) {
        echo json_encode(['ok' => false, 'error' => "bad byte at index $i: '$parts[$i]'"]);
        exit;
    }
    $bytes[$i] = $v;
}

// --- Parse BIN (u32-be layer count, then per layer u32 rows, per row u32 cols + cols*u32 block IDs) ---
$p = 0;
function readU32(&$p, $bytes, $n) {
    if ($p + 4 > $n) return null;
    $v = ($bytes[$p] << 24) | ($bytes[$p+1] << 16) | ($bytes[$p+2] << 8) | $bytes[$p+3];
    $p += 4;
    return $v;
}

function readU16(&$p, $bytes, $n) {
    if ($p + 2 > $n) return null;
    $v = ($bytes[$p] << 8) | ($bytes[$p+1]);
    $p += 2;
    return $v;
}

// Layer count
$layerCount = readU32($p, $bytes, $n);
if ($layerCount === null || $layerCount < 1 || $layerCount > 4) {
    echo json_encode(['ok' => false, 'error' => "bad layer count: $layerCount"]);
    exit;
}

$binEnd = null;
for ($l = 0; $l < $layerCount; $l++) {
    $rows = readU32($p, $bytes, $n);
    if ($rows === null) { echo json_encode(['ok' => false, 'error' => "bad rows at layer $l"]); exit; }
    for ($r = 0; $r < $rows; $r++) {
        $cols = readU32($p, $bytes, $n);
        if ($cols === null) { echo json_encode(['ok' => false, 'error' => "bad cols at layer $l row $r"]); exit; }
        $p += $cols * 4; // skip block IDs
        if ($p > $n) { echo json_encode(['ok' => false, 'error' => "BIN overflows at layer $l row $r"]); exit; }
    }
}
$binEnd = $p;

// --- Parse ACT (4 tables: u16 length + length*7 bytes) ---
$actStart = $binEnd;
$actLen = $n - $actStart;
// ACT minimum: 4 * (2 + 0) = 8 bytes for 4 empty tables
if ($actLen < 8) {
    echo json_encode(['ok' => false, 'error' => "ACT too short: $actLen bytes"]);
    exit;
}

// Validate ACT structure
// Validate ACT structure — lengths are byte counts (not entry counts)
// All 4 u16 lengths come first, then all data follows
$ap = $actStart;
$actLengths = [];
for ($t = 0; $t < 4; $t++) {
    $tlen = readU16($ap, $bytes, $n);
    if ($tlen === null) { echo json_encode(['ok' => false, 'error' => "bad ACT table $t length"]); exit; }
    $actLengths[] = $tlen;
}
// After reading 4 u16 lengths, ap should be at actStart + 8
// Then skip all data
for ($t = 0; $t < 4; $t++) {
    $ap += $actLengths[$t]; // length is already in bytes
}
if ($ap !== $n) {
    echo json_encode(['ok' => false, 'error' => "ACT trailing bytes: expected $ap, got $n"]);
    exit;
}

// All good — write files
$basePath = __DIR__ . '/../games/swf/52/res/data/default/';
$binData = '';
for ($i = 0; $i < $binEnd; $i++) $binData .= chr($bytes[$i]);
$actData = '';
for ($i = $binEnd; $i < $n; $i++) $actData .= chr($bytes[$i]);

// Backup
$now = date('Ymd_His');
@copy($basePath . 'mc_gh_map_data.bin', $basePath . "mc_gh_map_data.bin.bak.$now");
@copy($basePath . 'ZONE1ACT.act', $basePath . "ZONE1ACT.act.bak.$now");

// Overwrite
$ok1 = file_put_contents($basePath . 'mc_gh_map_data.bin', $binData) !== false;
$ok2 = file_put_contents($basePath . 'ZONE1ACT.act', $actData) !== false;

if ($ok1 && $ok2) {
    echo json_encode(['ok' => true, 'binBytes' => $binEnd, 'actBytes' => $actLen, 'totalBytes' => $n]);
} else {
    echo json_encode(['ok' => false, 'error' => 'write failed']);
}
