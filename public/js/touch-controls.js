/* Touch controls for the Sonic level player (index + /play routes).
 *
 * Overlay only activates on touch-capable devices:
 *   ('ontouchstart' in window) || navigator.maxTouchPoints > 0
 * Otherwise the container stays `display:none` and no listeners attach.
 *
 * Sprites (see touch-controls.css header for measured bboxes):
 *   TL cell = left dpad outer area (silver base)
 *   TR cell = right button outline
 *   BL cell = joystick knob (dpad knob + jump-button cap)
 *   BR cell = gold feedback ring; only the pushed HALF is revealed
 *             (e.g. left push => left half of BR + right half of TL)
 *
 * The Flash player runs under Ruffle, which listens for real keyboard
 * events on window. Touch is therefore translated into synthesized
 * ArrowLeft/ArrowRight/ArrowUp/ArrowDown (+ Space for jump) keydown/keyup
 * pairs dispatched to window/document/the player element. 4-way only:
 * the dominant axis wins, the knob travels along that axis alone.
 */
(function () {
  "use strict";

  var SPRITE = "/images/controls.png";
  var TRAVEL = 22; // px knob travel at 132px dpad size (scaled by size/132)
  var DEADZONE = 10; // px neutral radius at 132px dpad size

  var KEYMAP = {
    left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
    right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
    up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
    down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
    jump: { key: " ", code: "Space", keyCode: 32 }
  };

  function isTouchDevice() {
    if ("ontouchstart" in window) return true;
    if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) return true;
    if (typeof navigator !== "undefined" && navigator.msMaxTouchPoints > 0) return true;
    return false;
  }

  // Synthesize a keyboard event Ruffle/Flash will honor. keyCode/which are
  // read-only on KeyboardEvent, so they are patched via defineProperty.
  function sendKey(type, spec) {
    var ev;
    try {
      ev = new KeyboardEvent(type, {
        key: spec.key,
        code: spec.code,
        bubbles: true,
        cancelable: true
      });
    } catch (e) {
      ev = document.createEvent("KeyboardEvent");
      if (ev.initKeyboardEvent) {
        ev.initKeyboardEvent(type, true, true, window, spec.key, 0, "", false, "");
      } else {
        ev.initEvent(type, true, true);
      }
    }
    try {
      Object.defineProperty(ev, "keyCode", { value: spec.keyCode });
      Object.defineProperty(ev, "which", { value: spec.keyCode });
    } catch (e) {
      /* older engines ignore the patch; key/code still carry the meaning */
    }
    // Single dispatch: the player (or document fallback) bubbles through
    // document to window, so every listener fires exactly once.
    var player =
      document.querySelector("#gameswf ruffle-player") ||
      document.querySelector("#gameswf object") ||
      document.querySelector("#gameswf embed") ||
      document.getElementById("gameswf");
    var target = player || document;
    try {
      target.dispatchEvent(ev);
    } catch (e) {
      try {
        document.dispatchEvent(ev);
      } catch (ignored) {
        /* dispatch is best-effort */
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
      focusPlayer();
    }

    function focusPlayer() {
      var player =
        document.querySelector("#gameswf ruffle-player") ||
        document.getElementById("gameswf");
      if (player && player.focus) {
        try {
          player.focus();
        } catch (e) {
          /* focus is best-effort */
        }
      }
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
    } else {
      // Legacy touch fallback (multi-touch safe: track identifier).
      dpad.addEventListener(
        "touchstart",
        function (e) {
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
    }
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
        focusPlayer();
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
      } else {
        jumpBtn.addEventListener(
          "touchstart",
          function (e) {
            jumpPointer = e.changedTouches[0].identifier;
            root.setAttribute("data-jump", "1");
            sendKey("keydown", KEYMAP.jump);
            focusPlayer();
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
