// ts/ui.ts — Shadow DOM CSS + HTML templates

export const EDITOR_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:host { display: block; width: 100%; height: 100%; margin: 0; padding: 0; }
.editor { display: flex; flex-direction: column; width: 100%; height: 100%;
  margin: 0; padding: 0;
  font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000;
  background: #2a2a2a; overflow: hidden; user-select: none;
  border-radius: 0 0 10px 10px; }

/* ── top bar ── */
.topbar { display: flex; align-items: center; justify-content: space-between;
  margin: 0; padding: 4px 8px; background: #333; color: #fff; flex-shrink: 0; }
.topbar-l, .topbar-r { display: flex; align-items: center; gap: 6px; }
.topbar label { font-size: 12px; }
.btn { padding: 2px 8px; border: 1px solid #666; background: #555; color: #fff;
  cursor: pointer; font-size: 11px; font-family: inherit; }
.btn:hover { background: #777; }
.btn-active { background: #0a0; border-color: #0f0; }
.btn-clear { background: #633; border-color: #a44; }
.btn-clear:hover { background: #944; }

/* ── main split: canvas on top, tabs+options below ── */
.main { display: flex; flex-direction: column; flex: 1; min-height: 0; }

/* ── canvas area ── */
.canvas-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.canvas-wrap { flex: 1; overflow: auto; background: #d4e8c0; min-height: 0; }
canvas.display { display: block; cursor: crosshair; }

/* ── bottom: tabs + options (25% height) ── */
.bottom { display: flex; height: 25%; min-height: 140px; border-top: 2px solid #555; flex-shrink: 0; }
.panel-left { flex: 3; display: flex; flex-direction: column; overflow: hidden;
  border-right: 1px solid #555; background: #ddd; }
.tabs { display: flex; flex-shrink: 0; border-bottom: 1px solid #999; }
.tab { padding: 4px 10px; border: 1px solid #999; border-bottom: none;
  background: #ccc; cursor: pointer; font-size: 11px; font-family: inherit; }
.tab:hover { background: #ddd; }
.tab-active { background: #fff; font-weight: bold; }
.thumbstrip { flex: 1; display: flex; gap: 3px; padding: 4px;
  overflow-x: auto; overflow-y: hidden; align-items: stretch; }
.thumb { height: 100%; aspect-ratio: 1; border: 1px solid #888; cursor: pointer;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: #fff; }
.thumb:hover { border-color: #f00; }
.thumb canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated;
  image-rendering: crisp-edges; }
.thumb-txt { width: auto; min-width: 36px; padding: 2px 6px; font-size: 10px;
  text-align: center; line-height: 1.2; }
.desc { height: 20px; padding: 2px 6px; background: #f0f0f0; border-top: 1px solid #ccc;
  font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0; }

.panel-right { flex: 1; display: flex; flex-direction: column; padding: 8px;
  background: #eee; gap: 6px; }
.panel-right h4 { margin: 0 0 2px 0; font-size: 13px; }
.act-btn { padding: 6px 10px; border: 1px solid #888; background: #ddd;
  cursor: pointer; font-size: 12px; width: 100%; text-align: center;
  font-family: inherit; }
.act-btn:hover { background: #ccc; }
.status { margin-top: auto; padding: 4px; background: #fff; border: 1px solid #ccc;
  font-size: 11px; min-height: 20px; word-wrap: break-word; }

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
        <div class="desc">Select an item below</div>
      </div>
      <div class="panel-right">
        <h4>Options</h4>
        <button class="act-btn" data-action="test">Test Level</button>
        <button class="act-btn" data-action="save">Save</button>
        <button class="act-btn" data-action="fullscreen">Go Fullscreen</button>
        <div class="status">Ready</div>
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
