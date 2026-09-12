# Sonic Level Creator — level format & editor reference

Reverse-engineered from `games/swf/52/52.swf` (`ffdec -export script`),
`editors/swf/1/guide.pdf` (the original `SLC_Guide.doc`), the stock data
files under `games/swf/52/res/`, and the offline `amfphp/gateway.php` stub.
All code references are `MainCanvas.as` / `MainCanvasDraw.as` / `Main.as` /
`Utilities.as` unless stated otherwise. All multi-byte integers are
big-endian (`readUnsignedInt`/`readShort`); byte arrays are raw unsigned bytes.

- [1. Big picture](#1-big-picture)
- [2. The original editor UI (from guide.pdf)](#2-the-original-editor-ui-from-guidepdf)
- [3. Wire protocol: getting levels in and out](#3-wire-protocol-getting-levels-in-and-out)
- [4. The level blob: BIN + ACT](#4-the-level-blob-bin--act)
- [5. Byte-reader primitives (Utilities.as)](#5-byte-reader-primitives-utilitiesas)
- [6. Objects](#6-objects)
- [7. Terrain: blocks, tiles, maps](#7-terrain-blocks-tiles-maps)
- [8. Collision](#8-collision)
- [9. Tilesets and sprites](#9-tilesets-and-sprites)
- [10. Audio](#10-audio)
- [11. Camera, limits, spawns, modes](#11-camera-limits-spawns-modes)
- [12. Stock file inventory](#12-stock-file-inventory)
- [13. Limits, validation and editor constraints](#13-limits-validation-and-editor-constraints)
- [14. Extra specifics worth knowing](#14-extra-specifics-worth-knowing)
- [15. Open unknowns](#15-open-unknowns)

## 1. Big picture

A "level" as the player sees it is three things glued together:

1. **Terrain** — a grid of *block IDs* (`blockData`, from the BIN part).
   Blocks resolve through static per-zone tables into 16×16 px tiles cut from
   a zone sheet (`zoneN.png`), with collision derived from the block ID.
2. **Objects** — enemies, rings, springs, platforms, monitors, Sonic's spawn
   (`SONIC_NORMAL`), the goal Sign Post (`GOLE_NFLAG`), Star Posts
   (`SAVE_SFLAG`), etc. (from the ACT part, 7 bytes each).
3. **Session/progression** — handled by the PlaySEGA API (`insertCoin` →
   `getNonce` → play → `levelUp`/`gameOver`), irrelevant to authoring except
   that a level must contain a spawn and a goal or it cannot be tested or
   published (guide §12).

Custom levels always use `zoneNumber == ZONE_CUSTOM (6)` with the Zone-7
tileset, the Green Hill object-sprite set, and background set 6
(`loadStageImages`, `loadZoneImage`, `DistantBG.zonesets` — 7 entries,
index 6 is the custom one). There is exactly one custom theme; what varies
per level is layout, objects, map size and spawn/goal. Zone IDs
0–5 are Green Hill, Labyrinth, Marble, Star Light, Spring Yard, Scrap Brain;
acts are `ACT_1 = 0, ACT_2 = 1, ACT_3 = 2`.

The client canvas is 320×224 (`new BitmapData(320,224)` in `Main.gameInit`),
upscaled ×2 to 640×448. World coordinates are pixels; sub-pixel physics uses
`Utilities.FIXED_ONE` fixed point. Tile size is 16 px
(`Tile.ZONE_TILE_SIZE = 16`); a *block* is 16×16 tiles = 256×256 px
(rendered block images in `Downloads/temp/zone7/zone7/out/`, 135 of them).

## 2. The original editor UI (from guide.pdf)

`editors/swf/1/guide.pdf` (8 pages) describes the lost editor completely:

1. Name the level (`Start a new level` screen, `Start creating...`).
2. Pick **map size**: 3 blue rectangles (exact pixel dims unknown — the three
   sizes are baked into saved data, see §14).
3. **Tiles tab**: click tiles in the toolbar, drag onto the grid; snap-to-grid;
   scrollbar for more tiles.
4. Zoom buttons top-left; scroll via bottom/right scrollbars or Space+drag
   (drag unavailable in fullscreen).
5. Select + grey-cross deletes; drag moves; **Ctrl+drag copies** any
   tile/object.
6. **Objects tab** with hover descriptions per object; drag to place.
7. Max **7 objects per tile**; Object Counter top-right.
8. X clears the whole level (no undo).
9. **Essentials tab**: **Sonic Placer + Sign Post are mandatory** — no test
   without them.
10. **Test Level** plays it in-client (`LevelEditorAPI.TEST_LEVEL` /
    `RETURN_TO_EDITOR`); reaching the Sign Post unlocks **publish**
    (`PUBLISH_LEVEL`, irreversible).
11. Tabs include **Enemies** (badniks with behavior notes), **Rings** (toolbar
    tab visible in screenshots), moving platforms with **grey range marks**,
    **Solid Wall** objects (seal pass-through wall ends), **Star Posts**
    (checkpoints).

Popups living in the player (`popups/PopupCreator.as`) confirm the flows:
`createSaveQuitPop` (`save_quit`), `createSaveTestPop`
(`save_test_level`), `createDeleteMapPop` (`delete_level`),
`createPublishPop` (`publish`/`replay`), `createMaxObjectsPop`
("maximum number of objects for this section…"), `createWarningPop`.
Note: `Main.handleButtonEvent` only handles `publish`/`replay`/`close_popup`
— `save_quit`/`save_test_level`/`delete_level` were handled by the lost
editor shell, proving the editor hosted the player for test mode.

## 3. Wire protocol: getting levels in and out

`com.sega.playsega.api.LevelEditorAPI` (`SERVICE_NAME = "LevelEditorAPI"`,
AMF0 `NetConnection`): `createLevel / getLevel / deleteLevel /
publishLevel / testLevel / returnToEditor / saveLevel`. Gateway URL came from
`retreavePath()` per-domain; offline it is rewritten to
`<swf-base>/amfphp/gateway.php` (see `amfphp/gateway.php`).

- `getLevel([levelID:String, true])` → returns a **comma-separated decimal
  byte string**, e.g. `"0,0,0,4,6,0,0,39,…"`. `MainCanvas.getLevel` sends it;
  `onGetLevel(param:String)` runs it through
  `Utilities.readStringArray` (split on `,` → one `writeByte` per element →
  `ByteArray`), then `parseBinFile` + `parseActFile` back-to-back on the
  same buffer. Our `amfphp/gateway.php` serves exactly this (BIN+ACT joined).
- `publishLevel([mapID:String])` → `Main.onPublishLevel` pops
  "Congratulations, your level has been published!".
- `saveLevel`, `createLevel`, `deleteLevel`, `testLevel`, `returnToEditor`
  exist client-side; storage semantics are server-side (our stub answers
  success).

Because bytes travel as decimal text, the practical alphabet is `0-9` and
`,`: byte 255 costs 3 chars. A Green Hill blob
(`mc_gh_map_data.bin` 3284 B + `ZONE1ACT.act` 5223 B = 8507 B) encodes to
roughly 20–30 KB on the wire.

## 4. The level blob: BIN + ACT

`onGetLevel` treats the buffer as two concatenated files:

**BIN** → `parseBinFile` → `blockData = Utilities.read3DIntArray(buf)`:
`u32 n3` → `n3` × 2D arrays → each `u32 n2` → `n2` × 1D arrays → each
`u32 n1` + `n1` × `u32`. Then `MapH = blockData[stageNumber].length`,
`MapW = blockData[stageNumber][0].length`, and a `MapH×MapW` working copy
`tempBlockData`; `blockDataLoaded = true`. Verified framing:
`mc_gh_map_data.bin` starts `00 00 00 04` (n3=4) and `read3DIntArray`
consumes **exactly** its 3284 bytes — BIN is self-delimiting, so ACT starts
at the very next byte.

**ACT** → `parseActFile` → `zoneActTable = new Array(4)`; four `readShort()`
lengths, then `readByteArray` into each of the four tables; then
`objectInit()`. Verified: `ZONE1ACT.act` opens with shorts
`1498, 1715, 2002, 0` and `1498+1715+2002+0+8 == 5223` = file length exactly.
The four tables are per-act object lists (index = `stageNumber`, clamped to
≤ 3 in `objectInit`). `stageNumber` for custom levels comes from
`encStageNumber[7] = [ACT_1, ACT_2, ACT_3]`.

So to author a level you emit: `u32-be BIN` ++ `ACT shorts+bytes`, convert
to decimal CSV, and serve it from `getLevel`. To dissect one, split at the
byte offset where `read3DIntArray` stops.

## 5. Byte-reader primitives (Utilities.as)

- `readStringArray(String) : ByteArray` — `split(",")`, `writeByte` each
  (values wrap mod 256; keep 0–255).
- `readByteArray(ByteArray, Array)` — fills a pre-sized Array with
  `readByte` (signed).
- `readShortArray(ByteArray, Array)` — fills with `readShort`.
- `read1DIntArray` — `u32 n` + `n` × `u32`.
- `read2DIntArray` — `u32 n` + `n` × 1D arrays.
- `read3DIntArray` — `u32 n` + `n` × 2D arrays.
- `dSin/dCos(int)` — degree tables over `sinData`, scaled by `FIXED_ONE`.

## 6. Objects

### 6.1 Entry layout (7 bytes)

Every entry in a `zoneActTable[stage]` list is 7 bytes
(`objectInit`, `addObjectSet`):

| Byte | Meaning |
|---|---|
| 0–1 | X = `(b0 & 0xFF) << 8 \| (b1 & 0xFF)` (pixels) |
| 2–3 | Y = `(b2 & 0xFF) << 8 \| (b3 & 0xFF)` (pixels) |
| 4 | Flags/variant (mirroring, behavior subtype — per-object) |
| 5 | **Type ID** (`& 0xFF`; the tables in §6.2) |
| 6 | Sub-param. For rings: **extra ring count** (total = 1 + b6). Otherwise behavior sub-index. |

`objectInit` scans the list once: type `151` (`SONIC_NORMAL`) sets
`playerpositset = [(b0<<8)+(b1&0xFF), (b2<<8)+(b3&0xFF)]`
(traced as `SONIC DETECTED AT TILE/POSITION`); ring entries expand the
live-object budget by `1 + b6`; everything else counts 1. It builds
`zoneActTable2` (entry → first live index), `ObjectAct` and `ObjectDead`
(size = count + 20). `addObjectSet` instantiates runtime `objectData`
(25 slots: `[0]=active, [1]=type, [2]=x, [3]=y, [8]=homeX, [9]=homeY, …`)
with camera culling (`LSize/RSize`, `addAll` for enemies).

Rings come in 9 layout types; byte 6 fans them out (`addObjectSet`):
`0` = row +24px·i in X; `1` = column +24px·i in Y; `63/64/65` = diagonals
(−16/+16, +16/+16, +32/+32 per step); `66/67` = horizontal 16/32px steps;
`68/69` = vertical 16/32px steps. So one ring entry paints a whole line —
the editor's ring tool writes one entry, not N.

Byte 4 bit meanings vary: `drawChara` maps `objectData[19]` 1/2/3 to
mirror/mirror-rot180/rot180 rendering; many movers read it as direction or
phase (e.g. waterfall `objectData[19] * 4` rotation select).

### 6.2 Full type-ID table (MainCanvas.as constants)

`SFLAG` ≈ score/collectible-ish, `NFLAG` ≈ neutral/terrain-ish (naming only;
behavior is per-ID). Gaps (112–118, 122–124, 126–129, 132–134, 136–139,
142–144, 148–150, 159+) are unused by the player.

| ID | Name | Notes |
|---|---|---|
| 0 | RING_SFLAG_RING_18_00 | ring row → +X |
| 1 | RING_SFLAG_RING_00_18 | ring column → +Y |
| 2 | SPRING_RED | red spring (`sjump.png`) |
| 3 | BURANKO_NFLAG / BURANKO | swing; alt art `buranko_m.png` (marble), `buranko_s.png` (starlight), `buranko_.png` (scrapbrain) |
| 4 | THASHI_NFLAG | tall bridge/pole (`thashi.png`) |
| 5 | HASHI_NFLAG | bridge (`hashi.png`; labyrinth uses `water3.png`) |
| 6 | BREAK_SFLAG | breakable wall (`break.png`) |
| 7 | YUKA_NFLAG | floor block (`yuka.png`, marble; `beltcon.png` in scrapbrain) |
| 8 | TURI_NFLAG | hanging swing (`turi.png`, marble; +`turi2/3` variants) |
| 9 | TOGE_NFLAG | spikes (`toge.png`) |
| 10 | BOX_SFLAG | item box / TV monitor (contents from `item_nflag_ike_itemTable`, §6.4) |
| 11 | FBLOCK_NFLAG | falling block (`fblock.png`) |
| 12 | DAI_NFLAG | platform (`dai.png` / `dai_la.png` / `z_dai4_l.png`…) |
| 13 | YOGAN2_SFLAG | lava flows (`yogan2.png`) |
| 14 | MYOGAN_NFLAG | lava vent (`myogan.png`, +`myogan2.png` anim) |
| 15 | SWITCH2_NFLAG | switch (`switch2.png` / marble `switch.png`) |
| 16 | SHIMA_NFLAG | island platform (`shima.png`, `shima5.png` in springyard) |
| 17 | DAI2_NFLAG / DAI2 | moving platform (`dai2.png`; variants `dai2_0xE0/0xF0`) |
| 18 | BRKABE_SFLAG / BRKABE | breakable wall GH (`brkabe_g.png`; starlight `brkabe.png`) |
| 19 | PEDAL_NFLAG / PEDAL | pedal/seesaw part (`pedal.png`) |
| 20 | BREAK2_NFLAG | breakable variant |
| 21 | STEP_NFLAG / STEP | steps (`step.png`) |
| 22 | FUN_NFLAG | fan (`fun.png`) |
| 23 | SISOO_NFLAG | seesaw (`sisoo.png`) |
| 24 | BELT_NFLAG | conveyor (`beltcon.png` in scrapbrain) |
| 25 | PATA_NFLAG | flap enemy (`paka2.png` in scrapbrain) |
| 26 | FIRE6_NFLAG | flamethrower (`fire6.png`) |
| 27 | BRYUKA_NFLAG | bridge cable (`bryuka.png`, `bryuka_sc.png`) |
| 28 | MAWARU_NFLAG | spinner (`mawaru.png`) |
| 29 | YUKAI_NFLAG | floor trap (`yukai.png`) |
| 30 | DOOR_NFLAG / DOOR | door (`door.png`) |
| 31 | YUKAE_NFLAG | moving floor (`yukae.png`) |
| 32 | DAI4_NFLAG | large platform (`dai4.png`, `dai4_.png`, `z_dai4_l.png`) |
| 33 | ELE_NFLAG | elevator rail (`ele.png`) |
| 34 | BELTC_NFLAG / BELTC | belt control (`beltc.png`) |
| 35 | NOKO_NFLAG | nokonoko-ish enemy (`noko.png`) |
| 36 | SAVE_SFLAG | **Star Post checkpoint** (`save.png`) |
| 37 | KAGEB_NFLAG | shadow/deco (`kageb.png`) |
| 38 | BGSPR_NFLAG | background spring/deco |
| 39 | KAMERE_SFLAG | chameleon badnik (`kamere.png`) |
| 40 | HACHI_SFLAG | bee badnik (`hachi.png`) |
| 41 | MUSI_SFLAG | bug badnik (`musi.png`) |
| 42 | ITEM_NFLAG | loose item |
| 43 | ITEM_SFLAG | item sparkle |
| 44 | GOLE_NFLAG | **Sign Post goal** (`gole.png`; rotation table `gole_nflag_ike_rotTable`) |
| 45 | BTEN_NFLAG | button/base (`bten.png`) |
| 46 | BTEN_SFLAG | button lit (score table `bten_nflag_ike_score = [0,10000,1000,100]`) |
| 47 | BIGRING_NFLAG | giant ring (`ring_large.png`) |
| 48 | SCOLI_NFLAG | scanner/collider deco |
| 49 | IMO_SFLAG | caterpillar badnik (`imo.png`) |
| 50 | BROBO_SFLAG | robot badnik (`brobo.png`) |
| 51 | BUTA_SFLAG | pig badnik (`buta.png`) |
| 52 | HAGURUMA_NFLAG | gear |
| 53 | SHOOTER_NFLAG | shooter |
| 54 | DAINFLA | platform base (`dai.png` marble) |
| 55 | MASIN_NFLAG | machine (`masin_nflag_ike_x/y` offsets) |
| 56 | BOBIN_SFLAG | bumper-pin (`bobin.png`) |
| 57 | KANI_SFLAG | crab badnik (`kani.png`) |
| 58 | JYAMA_NFLAG | blocker (`jyama.png`) |
| 59 | FETAMA_NFLAG | moving ball (`fetama.png`?) |
| 60 | TEKYU_NFLAG | spiked ball (`tekyu.png`) |
| 61 | SIGNAL_NFLAG | signal (`signal.png`) |
| 62 | DAI2_SFLAG | platform lamp (`dai2_3.png`) |
| 63–69 | RING_* diagonal/column variants | see §6.1 fan-out |
| 70 | ARUMA_SFLAG | armadillo (`ArumaRunCount=94, SpeedX=500, SpeedY=400, StartOffsetX=160`) |
| 71 | YADO_SFLAG | hermit-crab badnik (`yado.png`) |
| 72 | ELEV_NFLAG_80 | elevator 80px |
| 73 | ELEV_NFLAG | elevator (`elev.png`) |
| 74 | UNI_SFLAG | uni badnik (`uni.png`) |
| 75 | MFIRE_NFLAG | flame jet (`mfire.png`) |
| 76 | HASHIRA_NFLAG | pillar |
| 77 | YOGANC_NFLAG | lava column (`yoganc.png`, heights `yoganc_nflag_ike_posY`) |
| 78 | BAT_SFLAG | bat badnik (`bat.png`, frames `batAnimTbl=[1,2,3,2]`) |
| 79 | OCHI_NFLAG | falling stalactite (`ochi.png`) |
| 80 | YARI_SFLAG | spear trap (`yari.png`, poses `yari_PosTable`) |
| 81 | MOGURA_SFLAG | mole badnik (`mogura.png`) |
| 82 | KAZARI_SFLAG | decoration (animated fire `DrawKazarifire`) |
| 83 | DAI3_NFLAG | platform (`dai3.png`, variants `DAI3_0x27/0x13`) |
| 84 | MIZU_NFLAG | water surface (`mizu.png`, `z_mizu.png`) |
| 85 | AWA_NFLAG | bubble vent (`awa.png`; sizes `awaSize`, positions `awaPos`, sine `awasintlb`) |
| 86 | FISH_CHOPPER | chopper fish (`fish.png`) |
| 87 | FISH_JAWS | jaws fish (`fish2.png`) |
| 88 | KASSYA_NFLAG | transport cart (`kassya.png`; path tables `kassya_nflag_ike_*`) |
| 89 | TAKI_NFLAG | waterfall (`SFX_WATERFALL`, `DrawWaterMap` modes) |
| 90 | SHIMA2_NFLAG | island variant |
| 91 | BOU_NFLAG | pole (`bou.png`) |
| 92 | BEN_NFLAG | valve (`ben.png`) |
| 93 | BEN_SFLAG | valve lit |
| 94 | TURI2 | swing frame 2 |
| 95 | TURI3 | swing frame 3 |
| 96 | TAMA | projectile (`tama.png`) |
| 97 | BAKUHATU | explosion (`bakuhatu.png`) |
| 98–99 | MYOGAN2 / YOGAN2 | lava anims |
| 100 | ANIMAL | freed animal (`animal.png`; pairs in `friendTbl`, arcs `MoveAnimalTbl`) |
| 101 | _FIRE | generic flame (`fire.png`) |
| 102 | BLOCK | solid block (`block.png` springyard) |
| 104 | OBJAWA | bubble object (`objawa.png`) |
| 105–108 | DAI3_0x27 / DAI3_0x13 / DAI2_0xE0 / DAI2_0xF0 | platform art variants |
| 109 | EFFECT | particle (`effect.png`) |
| 110 | MIZU_0x09 | water column art |
| 111 | WATER2 | water plane (`water2.png`) |
| 119 | CONTINUE | continue-screen art (`continue.png`) |
| 120–147 | BOSS_* | boss parts (GH/LAB/MAR/SL/SY/SB + ball/fire/eggman/eggmachine) |
| 151 | SONIC_NORMAL | **Sonic Placer (spawn)** (`sonic.png`) — mandatory |
| 152 | SONIC_SPECIAL | super sonic art (`sonic_s.png`) |
| 153 | SPRING_YELLOW | yellow spring (`sjump2.png`) |
| 154–158 | CHAOS_EMERALD / SONIC_WIN / SONIC_BANNER / END_ANIMATION / END_LANDSCAPE | end-sequence art |

Runtime-only projectile/object-2 IDs (`OBJ2_*`, spawned by code, never
authored): 1 BAKUHATU, 2 KEMURI, 3 BAKUDAN, 4 RING, 5 KIRA, 6 SCORE, 7 TAMA,
8 HACHI_TAMA, 9 KANI_TAMA, 10 BUTA_TAMA, 11 UNI_TAMA, 12 UNI2_TAMA,
13 BROBO_TAMA, 14 IMO_TAMA, 15 MUSI_KEMURI, 16–20 FIREBALL(–5), 21 KAZARIFIRE,
22–25 DBLOCK(–4), 26 BRKABE_G, 27 BOSS_SB_TAMA, 28 FRIC, 29 AZARASI,
30 NIWATORI, 31 USAGI, 32 PENGUIN, 33 RISU, 34 BUTA, 35 DEBUG.

### 6.3 Categories (editor tabs → ID groups)

Guide tabs map onto `loadStageImages` groups. **Always loaded**
(`default/`): continue, sonic ×2, tama, bigring, ring, save(StarPost),
effect, toge(spikes), springs ×2, bakuhatu, bten, animal. **Essentials**
(mandatory): 151 Sonic Placer, 44 Sign Post (`gole.png`), 36 Star Post
(`save.png`). **Enemies tab** = per-zone badnik set; custom levels reuse the
Green Hill set: 41 musi, 40 hachi, 86 fish-chopper, 39 kamere, 57 kani, plus
8 buranko, 4 thashi, 18 brkabe_g, 5 hashi, 58 jyama, 6 break, 37 kageb,
16 shima, 15 switch2. Other zones substitute their own lists (§9) — same IDs,
different PNGs (e.g. ID 57 kani art lives under each `zone_*/` folder).

### 6.4 Special objects and their bytes

- **TV monitors** (`BOX_SFLAG`, 10): byte 6 indexes
  `item_nflag_ike_itemTable = [8,0,4,3,2,1,0]`, decoded against
  `TV_LIFE=2, TV_SPEED=3, TV_SHEILD=4, TV_INVIN=5, TV_RINGS=6`.
- **BTEN score** (46): byte 6 indexes `[0,10000,1000,100]`.
- **GOLE** (44): goal sequence (`golecount`, `goleflag`, `gole_on`);
  rotation from `gole_nflag_ike_rotTable =
  [TRANS_NONE,TRANS_ROT90,TRANS_MIRROR_ROT270,TRANS_MIRROR]`;
  sparkle offsets `gole_nflag_ike_kiraTableX/Y`; reaching it calls
  `Main.onGoal` → score tally → `levelUp`.
- **SAVE** (36, Star Post): restart-point logic (`plsaveX/plsaveY/plsaveTime`).
- **Moving platforms** (12/17/32/62/83/…): grey range marks in the editor
  correspond to path tables such as `box_sflag_ike_def_X/Y`,
  `box_sflag_ike_col_X/Y`, `bten`-style def tables; `DAI2_0xE0/0xF0`,
  `DAI3_0x27/0x13` select art/behavior variants of the same base.
- **Solid Wall** (guide tip 2): a wall-cap object (block family) placed at
  wall ends — behaviorally a `BLOCK`/collision object, not terrain.
- **Water/bubbles** (labyrinth/custom water): 84/85/104/110/111/89 with
  `waterH/waterH2/waterH3`, breath timer `breathCount = 35*FPS`, drowning via
  `playerBreathChk`.

## 7. Terrain: blocks, tiles, maps

### 7.1 The chain block → chip → tile

Rendering (`DrawMapRegion`) and collision (`blockColChk2`,
`blockColChk_Enemy`) share one addressing scheme. Coordinates are pixels;
`x >> 4 >> 4` = block column (16 tiles of 16 px = 256 px), `y` likewise
(`% MapH` wraps vertically):

1. `blockID = tempBlockData[by][bx]` (working copy of BIN layer).
2. `chipNum = (blockID << 9) + ((x>>4 & 15) + ((y>>4 & 15) << 4) << 1) + 1`
   — each block owns a 512-byte slice (`<< 9`) of `mapData`, holding 256
   16-bit tile entries; the low 9 bits pick the tile inside the block.
3. `tileNum = mapData[chipNum] & 0xFF (+ imageOffset[chipNum>>1] << 8`;
   custom zones use `& 0xFFFF` / `<< 16`).
4. Rotation from `rotation[chipNum>>1]` (1→mirror, 2→mirror-rot180,
   3→rot180), then `tileManager.drawTile(canvas, tileNum, rot, sx, sy)`.
5. `Tile` cuts a 16×16 cell out of the zone sheet (`m_imgMimg`) at
   `(num % stride)*16, (num / stride)*16`, pre-rotated through 8
   `TRANS_*` matrices (none/rot90/180/270 × mirror).

### 7.2 The static tables (all under res/data/default/)

| File | Bytes | Loaded as | Role |
|---|---|---|---|
| `zoneN.bmd` | 37–139 KB | `BMD` → `mapData` (+`setMapData`) | tile-entry pool; each 512-B group = one block's 256 tiles |
| `MapLzoneN.blt` (+`zoneN.blt` request remapped to it by the dev server) | 440–6451 | `MapZoneBLT` → `mapFrontData` | foreground overlay map |
| `zoneN.blt` | 410 (`zone1.blt`); `zone7.blt` 6451 | `BLT` → `blockLinkTable` | block-ID → collision/shape linkage (`blockLinkTable[x] & 0xFF) << 5` indexes 32-byte `blockColTable` rows) |
| `blkcol.bct` | 8192 | `BlkCol` → `blockColTable` (4096×2) | per-pixel solid masks, bit-tested in `blockColChk2` (with mirror handling via `rotation`) |
| `scddirtbl.blt` | 522 | `ScdDirTbl` → `scddirtbl` (512+10) | slope/direction table |
| `scdtblwk.scd` | 8192 | `scdTblWk` → `scdtblwk` (512×16) | slope heights; rings rest on `scdtblwk[block + (x & 15)]` |
| `framedata.bin` | 5048 | `FrameData` → 3D int array | sprite animation frames (`drawFrame`, `frameData[id][anim]`) |
| `mc_obj_size_table.bin` | 1228 | `ObjSizeTbl` → 2D int array | per-object hitbox sizes |
| `mc_*_map_data.bin` | 2556–3760 | `BIN` → `blockData` (stock zones) | terrain grids (see §4) |
| `ZONE1ACT.act` | 5223 | `ZoneACT` → `zoneActTable` (stock) | object lists (see §4) |

`populateTileManager` walks `mapData.length / 512` groups, stepping 2 bytes,
and registers every nonzero tile as `new Tile(m_imgMimg, tileNum, rot, 0)`
(`tilesPopulated = true`). `fileLoaded` gates on all ten tables; a custom
zone additionally needs its BIN+ACT from `getLevel`.

### 7.3 setMapData bit layout (per tile entry)

Each `mapData` pair decodes (`_loc1_ = mapData[i<<1] & 0xFFFF`):
bits 0–1 → `imageOffset` (0/1/2 select tile bank), bits 3–4 →
`rotation` (0–3 mapped to mirror variants), bit 5 → `hitChk2 = 1` when
`>> 5 <= 1`, even `>> 5` → `hitChk = 1`. `hitChk`/`hitChk2` are fast-reject
masks consulted before the expensive `blockColTable` bit test
(`blockColChk2` returns solid unless `hitChk2` says passable;
`blockColChk_Enemy` requires both).

## 8. Collision

Pixel query, three flavors: `blockColChk2(x,y)` (player solid),
`blockColChk(x,y)` (variant), `blockColChk_Enemy` (enemies/objects, clamps
to grid edges instead of wrapping). All reduce to: block → chip →
`hitChk` pre-test → `blockLinkTable` → 32-byte `blockColTable` row →
single-bit test at `(15-(x&15))<<1 + ((y&15)>>3)` shifted by `7-(y&7)`
(mirrored when `rotation == 1`). Slope riding uses `scdtblwk`; enemy
grounding uses `blockColChk_Enemy` + `scdtblwk`; crush checks
(`crushingDeathChk`), spikes (`moveSpike`), hazard lava (`playdamageset`)
and water breath sit on top. Collision is therefore *fully determined by
block choice* — the editor never authors collision data, only block IDs
(plus Solid-Wall cap objects at leaky wall ends, guide tip 2).

## 9. Tilesets and sprites

- Zone sheets (`loadZoneImage`: `res/images/tilesets/zone{N}.png`,
  N = zone+1; custom → `zone7.png` 768×2144; others 256×208–608):
  zone1 256×448, zone2 256×208 (+`z_zone2.png` for Labyrinth act 3),
  zone3 256×368, zone4 256×448, zone5 256×448, zone6 256×608.
- The 135 `Downloads/temp/zone7/zone7/out/*.png` files are pre-rendered
  256×256 blocks (16×16 tiles) of the custom set — a ready-made block
  palette: filename number ↔ block ID used in BIN grids.
- Object art: `res/images/default/*.png` (always loaded: sonic ×2,
  tama, ring, bigring, save, effect, toge, sjump ×2, bakuhatu, bten,
  animal, continue, buranko, switch2) plus one `res/images/zone_*/` folder
  per theme (custom reuses `zone_greenhill/`; see §6.3 and the full
  `loadStageImages` listing for every zone/act variant, e.g. Labyrinth
  act 3 swaps to `zone_scrapbrain/z_*` art).
- HUD/HUD fonts: `loadHUDGraphics` (`t_license*`, `t_title.png`,
  `large_font5.png` → `Font`), `Font`/`FontMap`, `title_screen` and
  `collect_rings_btn` FLA symbols; text via `SystxtTable`/`zonetable`.

## 10. Audio

`SoundManager` (43 logical slots) → `SonicSound.soundFiles[]` loaded from
`res/audio/mp3/BGM/*.mp3` and `res/audio/mp3/SFX/*.mp3`, relative to
`ResourceManager.relativePath` (the content-SWF directory). Indices:
0 Green Hill (`S1_81`+`81_fast`), 1 Marble (`83`), 2 SpringYard (`85`),
3 Labyrinth (`82`), 4 StarLight (`84(loop)`), 5 ScrapBrain (`86(loop)`),
6 Invincible (`87`+fast), 7 1UP (`88`+fast), 8 Title (`8a`), 9 Boss
(`8c`), 10 BossFinal (`8c`), 11 StageClear (`8e`), 12 GameOver (`8f`),
13 Continue (`90`), 14 Credits (`91`), 15 Hurry (`92`), 16 Chaos (`92`?),
17 Sega jingle (`sega`), 19–45 SFX (`c5,a1,a0,a6,af,b5,b9,c1,cc,c6,cf,be,
ae,c8,a7,c9,b6,b3,a4,ac,cd,bd,c7,d0_4,c4,c0,a3`; 42 Waterfall is embedded
as `SFX_WATERFALL`). `loadAudio()` gates the title on all 43
(`ON_AUDIO_LOAD` → `initTitle`) — any 404 stalls boot on a white screen,
which is why this repo carries silent stubs for the historically missing
tracks (`82,83,85,84(loop),86(loop),8c,8f,90,91,92,d0_4`) plus the real
`LevelCreator/playsega_soniclevelmaker/` rips for the rest. Audio is
cosmetic to authoring; an editor needs none of it.

## 11. Camera, limits, spawns, modes

- `limitTable[zone][act] = [4, x0, x1, y0?, w, h]`-style camera/level bounds
  (7 zones × 4 acts; custom row reuses Green Hill's).
- `playpositbl[zone]` fallback spawn pairs (custom row:
  `[1568,363,3808,364,128,168,128,168]`), overridden by the Sonic Placer.
- `Main.mapID` (from `loaderInfo.parameters.levelid`, here 2914) selects the
  custom blob; `Main` canvas states: `MODE_TITLE=1, FIELD=2, STAGESELECT=3,
  STARTSTAGE=4, CLEARSTAGE=5, CONTINUE=6, CHAOS_EMERALD=7, END_SEQUENCE=8,
  FIELD_PAUSED=9, LOAD_LEVEL=10, JUMP_IN=11`; title sub-modes and the
  `TITLE_MODE_TITLE_MENU → fadeTimer → MODE_STAGESELECT → ZONE_CUSTOM`
  path drive test-play entry.
- `DistantBG.zonesets`: 7 background strip sets (index 6 = custom).
- HUD indices: score 0, time 1, rings 2/3, lifebox 4, large font 5, small
  font 6, colon 7.

## 12. Stock file inventory

`res/data/default/`: `blkcol.bct` 8192, `framedata.bin` 5048,
`MapLzone1.blt` 440, `MapLzone7.blt` 6451, `mc_{gh,la,ma,sb,sl,sy}_map_data.bin`
2556–3760, `mc_obj_size_table.bin` 1228, `scddirtbl.blt` 522,
`scdtblwk.scd` 8192, `ZONE1ACT.act` 5223, `zone1.blt` 410,
`zone1..6.bmd` 37–44 KB, `zone7.blt` 6451, `zone7.bmd` 139 KB. Note
`zone7.blt` ≡ `MapLzone7.blt` byte-identical (the dev server remaps
`zoneN.blt` requests onto `MapLzoneN.blt`). `res/audio/…` §10,
`res/images/{default,tilesets,zone_*}/` §9.

## 13. Limits, validation and editor constraints

- 7 objects per tile max (guide §10; `createMaxObjectsPop` server-side too).
- Spawn + goal mandatory (guide §12; `objectInit` needs type 151 or no
  `playerpositset`; goal drives `levelUp`).
- 4 ACT tables per blob (one per act slot); counts auto-expand for ring fans
  (`ObjectAct/ObjectDead` sized count+20).
- Publish is one-way (`PUBLISH_LEVEL` → congratulations popup, no unpublish
  path client-side); report flow (`frm_levelid`, `frm_reason`) exists on the
  play page.
- `Main.mapID` unsigned; negative disables custom fetch (`Main.mapID >= 0`
  gate in `loadStageData`).

## 14. Extra specifics worth knowing

- **Runtime init pipeline** (what a preview must replicate):
  `readStageObject → initStage` (reset water/camera, `loadStageData`,
  `loadZoneImage`, `DistantBG.setStage`, `loadStageImages`) →
  `parseBinFile/parseActFile` (async, any order) → `objectInit` →
  `loadNextLevel/endStageStart`. `stageDataLoaded()` requires all of
  `tempBlockData, mapData, mapFrontData, blockLinkTable, m_imgMimg,
  imageOffset, frameData, objectSizeTbl, scddirtbl, scdtblwk,
  blockColTable, zoneActTable`.
- **ResourceManager event types**: `BLT, BMD, MapZoneBLT, BIN, ZoneACT,
  ObjSizeTbl, FrameData, ScdDirTbl, scdTblWk, BlkCol, PNG, PNG_HUD,
  PNG_OBJECT` (+`ON_AUDIO_LOAD` from `SoundManager`).
- **GOLE** (44): idle (`objectData[5]==0`) watches a 24-px box
  (`playerColChk(x,y,x,y,24,24)`); touch plays `AUDIO_SFX_GOLE`, sets
  `gole_on`, spins (`[5]==1`, ~129 ticks via `initGoleStart`) then done
  (`[5]==2`). Byte 5 is also its art variant in `goal_draw`.
- **SAVE** (36, Star Post): watches an 8×32 box at `(x, y−12)`; touch plays
  `AUDIO_SFX_LAMPPOST` and writes `plsaveX/plsaveY (+20px below post)` plus
  `plsaveTime/plsaveTime2` (respawn point + clock).
- **BGM select** (`getZoneBGMNum`): custom → Green Hill default; Labyrinth
  act 3 → ScrapBrain; ScrapBrain act 3 → BossFinal; hurry/invincible/boss
  overrides (`AUDIO_HURRY/INVINCIBLE/BOSS_STAGE`).
- **Rings economy**: `oldringcount/ringcount`, HUD tallies, `resultRing =
  ringcount*100` at goal; time bonuses (`resultTime` 50000→1000 by
  `timeCountSecs/Mins`) feed `addScoreCount` → `Main.levelUp`.
- **TileManager**: 65536 slots max, 8 rotations each (`TRANS_NUMER_OF`);
  dead `drawTile` lookups are silently swallowed (try/catch), so bad tile
  IDs render as holes, not crashes.
- **AMF shapes** (`amfphp/gateway.php`): `insertCoin→true`,
  `getNonce→"playsega_offline"`, `levelUp→1`, `pauseGame/unPause→true`,
  `gameOver→[]`, `getScores→""`, `getNumRings→0`, `getUsername→"Guest"`,
  `debit→true`, `getLevel→BIN+ACT CSV`. Score integrity uses
  `Hex(MD5(score+nonce))` / `Hex(MD5(info+nonce))` — accepted blindly
  offline.
- **Map sizes**: no preset constants exist in code — `MapW/MapH` come purely
  from the BIN layer dims, so the editor's 3 sizes are just 3 grid
  dimensions baked into saved data.

## 15. Open unknowns

- The 3 editor map-size presets' exact block dimensions (only derivable from
  a saved blob's `MapW/MapH`).
- Per-object byte-4/byte-6 semantics beyond rings/TV/BTEN/GOLE (each `*_move`
  function documents its own; ~150 to mine).
- Moving-platform grey range-mark rendering (path tables partially mapped:
  `box_sflag_ike_*`, `kassya_nflag_ike_*`, `masin_nflag_ike_*`).
- Which IDs the editor's toolbar actually exposed vs engine-supported
  (boss IDs 120–147 and end-sequence 154–158 almost certainly hidden).
- Original `saveLevel`/`createLevel` server schemas (request shapes known,
  stored format unknown).
- `zone2..6.blt`/`MapLzone2..6.blt` absent locally (only 1 and 7 present).
