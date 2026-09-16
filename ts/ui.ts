// ts/ui.ts — Shadow DOM CSS + HTML templates

export const EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; margin: 0; padding: 0; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  margin: 0; padding: 8px; gap: 8px;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: linear-gradient(#ffffff, #e8e8e8); overflow: hidden; user-select: none;
  border: 1px solid #c9c9c9; border-top: none; border-radius: 0 0 10px 10px; }

/* ── top bar: flush header band inside the canvas container — full-bleed,
   top edge flush with the panel top, bottom border doubling as the divider
   over the canvas ── */
.topbar { display: flex; align-items: center; justify-content: space-between;
  margin: 0; padding: 4px 10px;
  background: linear-gradient(#f4f4f4, #d9d9d9);
  border: none; border-bottom: 1px solid #c9c9c9; border-radius: 7px 7px 0 0;
  color: #555; flex-shrink: 0; }
.topbar-l, .topbar-r { display: flex; align-items: center; gap: 6px; }
.topbar label { font-size: 12px; }
.btn { padding: 1px 10px; border: 1px solid #d99a3d; border-radius: 10px;
  background: linear-gradient(#fff8ea, #ffe2b0); color: #6b4a00;
  cursor: pointer; font-size: 11px; font-weight: bold; font-family: inherit; }
.btn-active { background: linear-gradient(#ffb85e, #ff9426); border-color: #d97a1a; color: #fff; }
.btn-clear { width: 20px; height: 20px; padding: 0; flex-shrink: 0;
  border-radius: 50%; border: none; position: relative;
  background: #999999; display: inline-block; }
.btn-clear svg { display: block; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%); }
.counter { background: #ffe9c0; border: 1px solid #d99a3d; border-radius: 8px;
  padding: 0 8px; font-weight: bold; color: #6b4a00; }
.topbar-r > span:first-child { color: #777; }

/* ── main split: canvas on top, tabs+options below ── */
.main { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px; }

/* ── canvas area: white rounded panel with padding ── */
.canvas-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; padding: 0; }
.canvas-wrap { flex: 1; overflow: auto; background: #fff; min-height: 0;
  border-radius: 0 0 7px 7px;
  scrollbar-color: #c2c2c2 #f0f0f0; scrollbar-width: thin; }
/* Grid-sized scroll space; the canvas itself is viewport-sized and sticky
   (see resizeCanvas) so the backing store never exceeds the visible area. */
.canvas-inner { position: relative; }
canvas.display { display: block; cursor: crosshair; border: none;
  position: sticky; top: 0; left: 0; }
.canvas-wrap::-webkit-scrollbar { width: 10px; height: 10px; }
.canvas-wrap::-webkit-scrollbar-track { background: #f0f0f0; }
.canvas-wrap::-webkit-scrollbar-thumb { background: #c2c2c2; border-radius: 5px;
  border: 2px solid #f0f0f0; }

/* ── bottom: tabs+strip panel + options box (30% height) ── */
.bottom { display: flex; height: 25%; min-height: 170px; max-height: 750px; gap: 8px; flex-shrink: 0; }
.panel-left { flex: 3; display: flex; flex-direction: column; overflow: hidden;
  background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; }
.tabs { display: flex; gap: 4px; flex-shrink: 0; padding: 0 8px;
  background: linear-gradient(#ffcf90, #ffa13c); border-radius: 7px 7px 0 0; }
.tab { padding: 4px 12px; border: none; border-radius: 6px 6px 0 0;
  background: transparent; color: #3d2c00; cursor: pointer;
  font-size: 12px; font-weight: bold; font-family: inherit; }
.tab:hover { background: rgba(255,255,255,0.35); }
.tab-active, .tab-active:hover { background: linear-gradient(#f4f4f4, #d9d9d9); }
.thumbstrip { flex: 1; display: flex; gap: 4px; padding: 6px;
  background: #f0f0f0; overflow-x: auto; overflow-y: hidden; align-items: stretch; }
.thumb { height: 100%; aspect-ratio: 1; border: none; border-radius: 10px; cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #fff; }
/* Tray art lives in an 80%-of-box bounding box: natural size, shrinking
   only when larger than the box (tiles and objects alike). */
.thumb canvas { display: block; width: auto; height: auto; max-width: 80%; max-height: 80%;
  image-rendering: pixelated; image-rendering: crisp-edges; }
.thumb-txt { width: auto; min-width: 36px; padding: 2px 6px; font-size: 10px;
  text-align: center; line-height: 1.2; }

.panel-right { flex: 1; display: flex; flex-direction: column; padding: 0 0 12px;
  background: linear-gradient(#ffffff, #e9e9e9);
  border: 1px solid #c4c4c4; border-radius: 10px;
  gap: 10px; max-width: 150px; }
.panel-right h4 { margin: 0; padding: 8px 14px 6px; font-size: 14px; color: #333;
  text-align: left; background: linear-gradient(#f4f4f4, #d9d9d9);
  border-radius: 9px 9px 0 0; border-bottom: 1px solid #c4c4c4; }
/* Options buttons: glossy site lozenge in pure CSS — no image assets.
   Tuned to the reference render: pale flash top (#ffedbe) falling to deep
   orange (#ffa028) with the turn at 45%, darker #e8932b rim, 8px corners,
   inset top highlight for the gloss, 13px near-black label. Hover lifts the
   whole ramp. Markup stays <a class="act-btn"><span>…</span></a> so the
   [data-action] wiring is untouched. Buttons carry their own side margins
   so the header divider runs full-bleed edge to edge. */
.act-btn { display: block; height: 28px; margin: 0 14px;
  background: linear-gradient(to bottom, #ffedbe 0%, #ffc46a 45%, #ffa028 100%);
  border: 1px solid #e8932b; border-radius: 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55);
  color: #333; font-weight: bold; font-size: 13px; font-family: inherit;
  text-decoration: none; cursor: pointer; }
.act-btn span { display: flex; align-items: center; justify-content: center;
  height: 100%; text-align: center;
  /* Measured against a screenshot: the flex-centered label sits ~0.5px low,
     so nudge up half a pixel. */
  transform: translateY(-0.5px); }
.act-btn:link, .act-btn:active, .act-btn:visited { color: #333; text-decoration: none; font-weight: bold; }
.act-btn:hover { background: linear-gradient(to bottom, #fff6dd 0%, #ffd38c 45%, #ffb14e 100%);
  color: #333; outline: none; }

/* ── bottom bar: uncolored, site lozenge2 sliding doors verbatim ── */
.bottombar { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 2px; background: transparent; color: #555; flex-shrink: 0; }
.bottombar-l { display: flex; gap: 0; }
/* Exact replica of a.lozenge2 (css/playsega.css) for the footer buttons:
   grey sliding doors with the real GIFs. Root-absolute paths since shadow
   <style> URLs resolve against the document base. Only addition vs site:
   border:none (these are <button>s, not <a>s). Markup carries the same
   inner <span>; [data-action] wiring is untouched. */
.btm-btn { background: transparent url('/images/bg_button_grey_end.gif') no-repeat scroll top right;
  color: #fff; display: inline-block; font-weight: bold; height: 22px;
  margin-right: 6px; padding: 0 18px 0 0; border: none; text-decoration: none;
  cursor: pointer; font-size: 12px; font-family: inherit; }
.btm-btn span { background: transparent url('/images/bg_button_grey_span.gif') no-repeat;
  display: block; line-height: 11px; padding: 5px 0 6px 16px; }
.btm-btn:link, .btm-btn:active, .btm-btn:visited { color: #fff; text-decoration: none; font-weight: bold; }
.btm-btn:hover { background-position: bottom right; color: #fff; outline: none; }
.btm-btn:hover span { background-position: bottom left; }

/* ── floating ghost ── */
.ghost { display: none; position: fixed; pointer-events: none; z-index: 9999;
  opacity: 0.7; border: 2px dashed #fff; background-color: rgba(0,0,0,0.3);
  image-rendering: pixelated; }
.ghost.visible { display: block; }

/* ── object tooltip (replaces native title) — 1:1 with reference ──
   White up-top with blue text, thin bottom gray gradient (same as
   Options header), no border, soft bottom shadow, pointer at 30% from
   left with a small left gap. Hidden by default; toggled .visible by
   JS after a hover delay. Fixed so it escapes the thumbstrip's overflow
   clip. Arrow is a downward-pointing white triangle, not a centered
   diamond. */
.obj-tooltip {
  position: fixed;
  z-index: 10000;
  max-width: 250px;
  background: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms ease;
  /* single drop-shadow that wraps bubble + diamond stem as one shape,
     so there's no seam between the gray footer and the point */
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.22)) drop-shadow(0 2px 4px rgba(0,0,0,0.16));
}
.obj-tooltip.visible { opacity: 1; visibility: visible; }
.obj-tooltip .tip-text {
  padding: 8px 14px 7px;
  color: #1767c9;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 16px;
  font-weight: 700;
  text-align: left;
  white-space: normal;
  word-wrap: break-word;
  background: #ffffff;
  border-radius: 6px 6px 0 0;
}
.obj-tooltip .tip-bottom {
  height: 18px;
  background: linear-gradient(#d9d9d9, #f4f4f4);
  border-radius: 0 0 6px 6px;
}
.obj-tooltip::after {
  content: "";
  position: absolute;
  /* start of tooltip with a small left gap; offset keeps the stem glued
     to the thumb's 30% point when the bubble is viewport-clamped.
     Flat-top triangle flush to the gray footer so the gradient flows
     into the point with no diamond notch or seam. */
  left: calc(22px + var(--tip-arrow-offset, 0px));
  bottom: -8px;
  width: 0;
  height: 0;
  background: transparent;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 8px solid #f4f4f4;
  transform: translateX(-50%);
  box-shadow: none;
}

/* ── test mode: persistent player overlaying the whole editor space ──
   The player is created once at boot and kept alive (muted) behind the
   editor so Test opens warm. .warm renders it with real dimensions but
   invisible (display:none would leave Ruffle with nothing to boot into);
   .active shows it. No synthetic clicks — the user clicks the title. */
.editor.hidden { display: none; }
.testmode { display: none; width: 100%; height: 100%; margin: 0; padding: 0;
  position: absolute; inset: 0; z-index: 5; background: #000; overflow: hidden;
  border-radius: 0 0 10px 10px; }
.testmode.active { display: flex; align-items: center; justify-content: center;
  visibility: visible; opacity: 1; pointer-events: auto; }
/* .warm must stay truly invisible even if Ruffle forces visibility:visible
   inside its own shadow DOM — opacity:0 on the parent cannot be overridden
   by children, unlike visibility. Pointer events fully off so the overlay
   never intercepts editor clicks while warming. */
.testmode.warm { display: flex; align-items: center; justify-content: center;
  visibility: hidden; opacity: 0 !important; pointer-events: none !important; }
.testmode.warm * { pointer-events: none !important; }
.ruffle-holder { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; background: #000; }
.ruffle-holder ruffle-player { display: block; width: 100%; height: 100%; background: #000; }
/* Exact replica of a.lozenge1 (css/playsega.css) — the orange "Sign up!"
   sliding doors with the real GIFs. Root-absolute paths since shadow
   <style> URLs resolve against the document base. Only addition vs site:
   border:none + positioning (this is a <button> pinned top-left, not an <a>).
   Markup carries the same inner <span>; [data-action] wiring is untouched. */
.stop-test { background: transparent url('/images/bg_button_a.gif') no-repeat scroll top right;
  color: #4c4c4c; display: block; float: left; font-weight: bold; height: 22px;
  margin-right: 6px; padding: 0 18px 0 0; border: none; text-decoration: none;
  cursor: pointer; font-size: 12px; font-family: inherit;
  position: absolute; top: 8px; left: 8px; z-index: 10; }
.stop-test span { background: transparent url('/images/bg_button_span.gif') no-repeat;
  display: block; line-height: 11px; padding: 5px 0 6px 16px; }
.stop-test:link, .stop-test:active, .stop-test:visited { color: #4c4c4c; text-decoration: none; font-weight: bold; }
.stop-test:hover { background-position: bottom right; color: #4c4c4c; outline: none; }
.stop-test:hover span { background-position: bottom left; }
`;

export const EDITOR_HTML = `
<div class="editor">
  <div class="main">
    <div class="canvas-area">
      <div class="topbar">
        <div class="topbar-l">
          <label>Zoom:</label>
          <button class="btn btn-active" data-zoom="2">100%</button>
          <button class="btn" data-zoom="1">50%</button>
          <button class="btn" data-zoom="0.5">25%</button>
        </div>
        <div class="topbar-r">
          <span>Object Counter:</span>
          <span class="counter">0</span>
          <button class="btn btn-clear" title="Clear entire level"><svg viewBox="0 0 12 12" width="12" height="12"><line x1="3" y1="3" x2="9" y2="9" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>
      </div>
      <div class="canvas-wrap">
        <div class="canvas-inner"><canvas class="display"></canvas></div>
      </div>
    </div>

    <div class="bottom">
      <div class="panel-left">
        <div class="tabs">
          <button class="tab tab-active" data-tab="tiles">Tiles</button>
          <button class="tab" data-tab="objects">Objects</button>
          <button class="tab" data-tab="rings">Rings</button>
          <button class="tab" data-tab="enemies">Enemies</button>
          <button class="tab" data-tab="essentials">Essentials</button>
        </div>
        <div class="thumbstrip"></div>
      </div>
      <div class="panel-right">
        <h4>Options</h4>
        <a class="act-btn" data-action="test"><span>Test Level</span></a>
        <a class="act-btn" data-action="save"><span>Save</span></a>
        <a class="act-btn" data-action="fullscreen"><span>Go Fullscreen</span></a>
      </div>
    </div>
  </div>

  <div class="bottombar">
    <div class="bottombar-l">
      <button class="btm-btn" data-action="mylevels"><span>My Levels</span></button>
      <button class="btm-btn" data-action="alllevels"><span>All Levels</span></button>
    </div>
    <button class="btm-btn" data-action="share"><span>SHARE</span></button>
  </div>

  <div class="ghost" id="ghost"></div>
</div>

<div class="testmode">
  <div class="ruffle-holder"></div>
  <button class="stop-test" data-action="stoptest"><span>Stop testing</span></button>
</div>
`;
