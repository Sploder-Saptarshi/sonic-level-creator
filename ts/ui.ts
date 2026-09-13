// ts/ui.ts — Shadow DOM CSS + HTML templates

export const EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; margin: 0; padding: 0; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  margin: 0; padding: 8px; gap: 8px;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: linear-gradient(#ffffff, #e8e8e8); overflow: hidden; user-select: none;
  border-radius: 10px; }

/* ── top bar (light, like the site chrome) ── */
.topbar { display: flex; align-items: center; justify-content: space-between;
  margin: 0; padding: 2px 4px; background: transparent; color: #555; flex-shrink: 0; }
.topbar-l, .topbar-r { display: flex; align-items: center; gap: 6px; }
.topbar label { font-size: 12px; }
.btn { padding: 1px 10px; border: 1px solid #d99a3d; border-radius: 10px;
  background: linear-gradient(#fff8ea, #ffe2b0); color: #6b4a00;
  cursor: pointer; font-size: 11px; font-weight: bold; font-family: inherit; }
.btn-active { background: linear-gradient(#ffb85e, #ff9426); border-color: #d97a1a; color: #fff; }
.btn-clear { width: 20px; height: 20px; padding: 0; flex-shrink: 0;
  border-radius: 50%; border: 1px solid #999;
  background: linear-gradient(#ffffff, #e2e2e2); color: #666;
  font-size: 11px; font-weight: bold; line-height: 18px; text-align: center; }
.counter { background: #ffe9c0; border: 1px solid #d99a3d; border-radius: 8px;
  padding: 0 8px; font-weight: bold; color: #6b4a00; }
.topbar-r > span:first-child { color: #777; }

/* ── main split: canvas on top, tabs+options below ── */
.main { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 8px; }

/* ── canvas area: white rounded panel with padding ── */
.canvas-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0;
  background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; padding: 8px; }
.canvas-wrap { flex: 1; overflow: auto; background: #fff; min-height: 0;
  scrollbar-color: #c2c2c2 #f0f0f0; scrollbar-width: thin; }
.canvas-wrap::-webkit-scrollbar { width: 10px; height: 10px; }
.canvas-wrap::-webkit-scrollbar-track { background: #f0f0f0; }
.canvas-wrap::-webkit-scrollbar-thumb { background: #c2c2c2; border-radius: 5px;
  border: 2px solid #f0f0f0; }
canvas.display { display: block; cursor: crosshair; border: 1px solid #d5d5d5; }

/* ── bottom: tabs+strip panel + options box (30% height) ── */
.bottom { display: flex; height: 30%; min-height: 170px; gap: 8px; flex-shrink: 0; }
.panel-left { flex: 3; display: flex; flex-direction: column; overflow: hidden;
  background: #fff; border: 1px solid #c9c9c9; border-radius: 8px; }
.tabs { display: flex; gap: 4px; flex-shrink: 0; padding: 0 8px;
  background: linear-gradient(#ffcf90, #ffa13c); border-radius: 7px 7px 0 0; }
.tab { padding: 4px 12px; border: none; border-radius: 6px 6px 0 0;
  background: transparent; color: #3d2c00; cursor: pointer;
  font-size: 12px; font-weight: bold; font-family: inherit; }
.tab:hover { background: rgba(255,255,255,0.35); }
.tab-active { background: #fff; }
.thumbstrip { flex: 1; display: flex; gap: 4px; padding: 6px;
  background: #fff; overflow-x: auto; overflow-y: hidden; align-items: stretch; }
.thumb { height: 100%; aspect-ratio: 1; border: 1px solid #b5b5b5; cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #fff; }
.thumb:hover { border-color: #f00; }
.thumb canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated;
  image-rendering: crisp-edges; }
/* Object thumbs: same forced-square box as tiles, but art inside stays at
   original 1x pixels (attribute size from paintThumb scale=1), centered,
   shrinking only if larger than the box. */
.thumb-obj canvas { width: auto; height: auto; max-width: 100%; max-height: 100%;
  object-fit: contain; }
.thumb-txt { width: auto; min-width: 36px; padding: 2px 6px; font-size: 10px;
  text-align: center; line-height: 1.2; }

.panel-right { flex: 1; display: flex; flex-direction: column; padding: 10px 14px;
  background: linear-gradient(#ffffff, #e6e6e6);
  border: 1px solid #c9c9c9; border-radius: 8px;
  gap: 6px; max-width: 150px; }
.panel-right h4 { margin: 0 0 4px 0; padding-bottom: 6px; font-size: 13px; color: #333;
  text-align: left; border-bottom: 1px solid #c9c9c9; }
/* Options buttons: site lozenge remade in pure CSS — no image assets.
   Extracted via Python from bg_button_span.gif (300x44: normal rows 0-21,
   hover rows 22-43):
   - 1px #ffa035 border on all four sides (edge rows/cols uniformly #ffa035).
   - Body horizontally flat, near-linear vertical ramp over the inner 20
     rows: normal #fee6ba -> #ffc376 (row 10, 47.5%) -> #ffa137; hover
     #fdf2de -> #fece94 (47.5%) -> #ffad4f.
   - Corner alpha-boundary circle fit: r~=6.6 top (light-matte AA fringe
     inflates it) / r~=8.0 bottom -> 8px radius at 22px tall; buttons are
     rendered larger (28px) with the radius scaled proportionally to 10px.
     Box is border-box so the 26px content box stretches the %-stop ramp.
   Shadow DOM seals out page CSS, so the rule lives here. Markup stays
   <a class="act-btn"><span>…</span></a> so [data-action] wiring is untouched. */
.act-btn { display: block; height: 28px; margin: 0 0 6px 0;
  background: linear-gradient(to bottom, #fee6ba 0%, #ffc376 47.5%, #ffa137 100%);
  border: 1px solid #ffa035; border-radius: 10px;
  color: #4c4c4c; font-weight: bold; font-size: 12px; font-family: inherit;
  text-decoration: none; cursor: pointer; }
.act-btn span { display: block; line-height: 11px; padding: 7px 10px 8px 16px; text-align: center; }
.act-btn:link, .act-btn:active, .act-btn:visited { color: #4c4c4c; text-decoration: none; font-weight: bold; }
.act-btn:hover { background: linear-gradient(to bottom, #fdf2de 0%, #fece94 47.5%, #ffad4f 100%);
  color: #4c4c4c; outline: none; }

/* ── bottom bar ── */
.bottombar { display: flex; align-items: center; justify-content: space-between;
  padding: 4px 8px; background: #333; color: #fff; flex-shrink: 0; }
.bottombar-l { display: flex; gap: 6px; }
.btm-btn { padding: 3px 10px; border: 1px solid #666; background: #555; color: #fff;
  cursor: pointer; font-size: 11px; font-family: inherit; }
.btm-btn:hover { background: #777; }

/* ── floating ghost ── */
.ghost { display: none; position: fixed; pointer-events: none; z-index: 9999;
  opacity: 0.7; border: 2px dashed #fff; background-color: rgba(0,0,0,0.3);
  image-rendering: pixelated; }
.ghost.visible { display: block; }
`;

export const EDITOR_HTML = `
<div class="editor">
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
      <button class="btn btn-clear" title="Clear entire level">X</button>
    </div>
  </div>

  <div class="main">
    <div class="canvas-area">
      <div class="canvas-wrap">
        <canvas class="display"></canvas>
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
      <button class="btm-btn" data-action="mylevels">My Levels</button>
      <button class="btm-btn" data-action="alllevels">All Levels</button>
    </div>
    <button class="btm-btn" data-action="share">SHARE</button>
  </div>

  <div class="ghost" id="ghost"></div>
</div>
`;
