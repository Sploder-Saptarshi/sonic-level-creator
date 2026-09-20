/* Touch controls for the Sonic level player (index + /play routes).
 *
 * Overlay only activates on touch-capable devices:
 *   ('ontouchstart' in window) || navigator.maxTouchPoints > 0
 * Otherwise the container stays `display:none` and no listeners attach.
 * Visibility additionally requires the fullscreen stage (see
 * touch-controls.css): touch-fullscreen.js enters it on a touch inside
 * the SWF, so the controls only ever appear in fullscreen play.
 *
 * Sprites (see touch-controls.css header for measured bboxes):
 *   TL cell = left dpad outer area (silver base)
 *   TR cell = right button outline
 *   BL cell = joystick knob (dpad knob + jump-button cap)
 *   BR cell = gold feedback ring; only the pushed HALF is revealed
 *             (e.g. left push => left half of BR + right half of TL)
 *
 * The game SWF carries ExternalInterface touch hooks (tcKeyDown/tcKeyUp,
 * added with FFDec): they write straight into the game's keyPressState
 * array, so no keyboard focus and no synthetic key events are needed.
 * 4-way only: the dominant axis wins, the knob travels along that axis
 * alone. Key codes match the SWF's Utilities.KEY_*_INDEX values.
 */
(function () {
  "use strict";

  var SPRITE = "/images/controls.png";
  var TRAVEL = 16; // px knob travel at 132px dpad size (scaled by size/132)
  var DEADZONE = 10; // px neutral radius at 132px dpad size

  // Touch codes match the SWF's Utilities.KEY_*_INDEX values exactly.
  var KEYMAP = {
    left: 37,
    right: 39,
    up: 38,
    down: 40,
    jump: 32
  };

  function isTouchDevice() {
    if ("ontouchstart" in window) return true;
    if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) return true;
    if (typeof navigator !== "undefined" && navigator.msMaxTouchPoints > 0) return true;
    return false;
  }

  // Touch input via the SWF's ExternalInterface hooks (tcKeyDown/tcKeyUp,
  // added to 52.swf with FFDec): they write straight into the game's
  // keyPressState array. Same pattern as the editor's editorStartAudio
  // hook — element method first, then the versioned ruffle() API.
  function sendKey(type, code) {
    var method = type === "keydown" ? "tcKeyDown" : "tcKeyUp";
    var player =
      document.querySelector("#gameswf ruffle-player") ||
      document.querySelector("#gameswf object") ||
      document.querySelector("#gameswf embed") ||
      document.getElementById("gameswf");
    var targets = [];
    if (player) targets.push(player);
    try {
      if (player && typeof player.ruffle === "function") {
        var api = player.ruffle();
        if (api) targets.push(api);
      }
    } catch (e) {
      /* versioned API is best-effort */
    }
    for (var i = 0; i < targets.length; i++) {
      try {
        if (typeof targets[i][method] === "function") {
          targets[i][method](code);
          return;
        }
      } catch (e) {
        /* try the next target */
      }
    }
  }

  function setDir(root, dir) {
    if (dir) root.setAttribute("data-dir", dir);
    else root.removeAttribute("data-dir");
  }

  function init() {
    if (!isTouchDevice()) return; // desktop: overlay stays hidden
    var container = document.getElementById("gamecontainer");
    var root = document.getElementById("touch-controls");
    if (!container || !root) return;

    // Preload the sheet so first touch never flashes unstyled.
    var preload = new Image();
    preload.src = SPRITE;

    root.classList.add("tc-on");
    // Only the two controls accept touches; the rest lets Flash through.
    var dpad = root.querySelector(".tc-dpad");
    var knob = root.querySelector(".tc-knob");
    if (!dpad || !knob) return;
    var jumpBtn = root.querySelector(".tc-btn");

    // Show the controls only while gameplay is in progress (not on the
    // title screen). The SWF exposes tcInGame()/tcMode() via
    // ExternalInterface; unknown/unavailable counts as not playing.
    // NOTE: tcMode() is authoritative — this Ruffle build demonstrably
    // marshals Numbers (tcMode 1/2 verified live) while the Boolean
    // return is unreliable, so gameplay is detected as mode == 2
    // (MainCanvas.MODE_FIELD).
    function refreshPlaying() {
      var playing = false;
      try {
        var player =
          document.querySelector("#gameswf ruffle-player") ||
          document.querySelector("#gameswf object") ||
          document.querySelector("#gameswf embed") ||
          document.getElementById("gameswf");
        var cbs = [];
        if (player) cbs.push(player);
        try {
          if (player && typeof player.ruffle === "function") {
            var api = player.ruffle();
            if (api) cbs.push(api);
          }
        } catch (e) {
          /* versioned API is best-effort */
        }
        for (var i = 0; i < cbs.length && !playing; i++) {
          try {
            if (typeof cbs[i].tcInGame === "function") {
              if (cbs[i].tcInGame() === true) playing = true;
            }
          } catch (e) {
            /* try the next target */
          }
          try {
            if (!playing && typeof cbs[i].tcMode === "function") {
              if (cbs[i].tcMode() === 2) playing = true;
            }
          } catch (e) {
            /* try the next target */
          }
        }
      } catch (e) {
        playing = false;
      }
      if (playing) root.classList.add("tc-playing");
      else root.classList.remove("tc-playing");
    }
    refreshPlaying();
    setInterval(refreshPlaying, 500);

    var held = null; // currently asserted dpad direction or null
    var activePointer = null;

    function release() {
      if (held) {
        sendKey("keyup", KEYMAP[held]);
        held = null;
      }
      setDir(root, null);
      knob.style.transform = "translate(0px,0px)";
    }

    function press(dir) {
      if (held === dir) return;
      release();
      held = dir;
      setDir(root, dir);
      var scale = dpad.clientWidth / 132 || 1;
      var t = TRAVEL * scale;
      var x = 0;
      var y = 0;
      if (dir === "left") x = -t;
      else if (dir === "right") x = t;
      else if (dir === "up") y = -t;
      else if (dir === "down") y = t;
      knob.style.transform = "translate(" + x + "px," + y + "px)";
      sendKey("keydown", KEYMAP[dir]);
    }

    function dirFromPoint(cx, cy) {
      var r = dpad.getBoundingClientRect();
      var dx = cx - (r.left + r.width / 2);
      var dy = cy - (r.top + r.height / 2);
      var scale = dpad.clientWidth / 132 || 1;
      if (Math.sqrt(dx * dx + dy * dy) < DEADZONE * scale) return null;
      // 4-way constraint: dominant axis only.
      if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
      return dy < 0 ? "up" : "down";
    }

    function onDown(e) {
      if (activePointer !== null) return;
      activePointer = e.pointerId !== undefined ? e.pointerId : "touch";
      try {
        dpad.setPointerCapture(e.pointerId);
      } catch (err) {
        /* capture optional */
      }
      var p = dirFromPoint(e.clientX, e.clientY);
      if (p) press(p);
      else release();
      e.preventDefault();
    }

    function onMove(e) {
      var id = e.pointerId !== undefined ? e.pointerId : "touch";
      if (id !== activePointer) return;
      var p = dirFromPoint(e.clientX, e.clientY);
      if (p) press(p);
      else release();
      e.preventDefault();
    }

    function onUp(e) {
      var id = e.pointerId !== undefined ? e.pointerId : "touch";
      if (id !== activePointer) return;
      activePointer = null;
      release();
      e.preventDefault();
    }

    if (window.PointerEvent) {
      dpad.addEventListener("pointerdown", onDown);
      dpad.addEventListener("pointermove", onMove);
      dpad.addEventListener("pointerup", onUp);
      dpad.addEventListener("pointercancel", onUp);
    }
    // Touch events always ride along: whichever fires first (touchstart
    // or pointerdown) wins via the activePointer guard, so registration
    // happens ONTAP on every engine instead of waiting for the slower
    // path. Multi-touch safe: track identifier.
    dpad.addEventListener(
      "touchstart",
      function (e) {
        if (activePointer !== null) {
          e.preventDefault();
          return;
        }
        var t = e.changedTouches[0];
        activePointer = t.identifier;
        var p = dirFromPoint(t.clientX, t.clientY);
        if (p) press(p);
        else release();
        e.preventDefault();
      },
      { passive: false }
    );
    dpad.addEventListener(
      "touchmove",
      function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          var t = e.changedTouches[i];
          if (t.identifier !== activePointer) continue;
          var p = dirFromPoint(t.clientX, t.clientY);
          if (p) press(p);
          else release();
        }
        e.preventDefault();
      },
      { passive: false }
    );
    var end = function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier !== activePointer) continue;
        activePointer = null;
        release();
      }
      e.preventDefault();
    };
    dpad.addEventListener("touchend", end, { passive: false });
    dpad.addEventListener("touchcancel", end, { passive: false });
    // Leaving the control with the pointer down must not stick a key.
    dpad.addEventListener("pointerleave", function (e) {
      if (activePointer !== null && e.pointerType === "mouse") {
        activePointer = null;
        release();
      }
    });

    // Jump button (TR outline + BL knob cap) => Space.
    if (jumpBtn) {
      var jumpPointer = null;
      var jumpOn = function (e) {
        if (jumpPointer !== null) return;
        jumpPointer = e.pointerId !== undefined ? e.pointerId : "touch";
        root.setAttribute("data-jump", "1");
        sendKey("keydown", KEYMAP.jump);
        e.preventDefault();
      };
      var jumpOff = function (e) {
        var id = e.pointerId !== undefined ? e.pointerId : "touch";
        if (id !== jumpPointer) return;
        jumpPointer = null;
        root.removeAttribute("data-jump");
        sendKey("keyup", KEYMAP.jump);
        e.preventDefault();
      };
      if (window.PointerEvent) {
        jumpBtn.addEventListener("pointerdown", jumpOn);
        jumpBtn.addEventListener("pointerup", jumpOff);
        jumpBtn.addEventListener("pointercancel", jumpOff);
      }
      // touchstart rides along unconditionally: whichever fires first
      // wins via the jumpPointer guard, so the jump registers ONTAP on
      // every engine.
      jumpBtn.addEventListener(
        "touchstart",
        function (e) {
          if (jumpPointer !== null) {
            e.preventDefault();
            return;
          }
          jumpPointer = e.changedTouches[0].identifier;
          root.setAttribute("data-jump", "1");
          sendKey("keydown", KEYMAP.jump);
          e.preventDefault();
        },
        { passive: false }
      );
      var jEnd = function (e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier !== jumpPointer) continue;
          jumpPointer = null;
          root.removeAttribute("data-jump");
          sendKey("keyup", KEYMAP.jump);
        }
        e.preventDefault();
      };
      jumpBtn.addEventListener("touchend", jEnd, { passive: false });
      jumpBtn.addEventListener("touchcancel", jEnd, { passive: false });
    }

    // Safety: never leave an arrow held if the page hides.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        activePointer = null;
        release();
      }
    });
    window.addEventListener("blur", function () {
      activePointer = null;
      release();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
