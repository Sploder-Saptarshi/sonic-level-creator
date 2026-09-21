/* Gamepad controls for the Sonic level player (index + /play routes).
 *
 * Reuses the SWF's ExternalInterface touch hooks (tcKeyDown/tcKeyUp, added
 * with FFDec — see touch-controls.js): they dispatch synthetic
 * KeyboardEvents straight into the game's keyPressState array, so no
 * keyboard focus and no DOM key events are needed. No SWF changes were
 * required for gamepads; this script sends the same key codes the touch
 * overlay sends (Utilities.KEY_*_INDEX values).
 *
 * Standard-mapping gamepads only (navigator.getGamepads):
 *   dpad (12-15) or left stick => arrows (37/38/39/40, gameplay + menus)
 *   A/B/X/Y/LB/RB/LT/RT (0-7)  => Space (32, jump / select)
 *   A (0) also taps Enter (13, pause-menu confirm)
 *   Start (9)   => P (80, pause open/resume) + title-screen click fallback
 *   Select (8)  => Escape (27, pause menu close)
 *   A (0) also clicks for the title screen (MouseEvent.CLICK starts the
 *   game; keyboard alone cannot). The click only fires while tcMode() != 2
 *   (MainCanvas.MODE_FIELD), so gameplay clicks can never stick.
 *
 * Ruffle-only: the player lookup targets <ruffle-player> and nothing
 * else. On browsers running the real Flash plugin there is no
 * ruffle-player, so every sendKey/click is a no-op and the plugin object
 * (<object>/<embed>) is never touched.
 *
 * Polling runs on requestAnimationFrame but only while a gamepad is
 * connected (starts on gamepadconnected, parks itself when the last pad
 * leaves) and ORs every connected pad, so pad index never matters and
 * there is zero idle cost. All held keys release on blur/hide/disconnect.
 */
(function () {
  "use strict";

  // Key codes match the SWF's Utilities.KEY_*_INDEX values exactly, plus
  // the menu keys handled by MenuController / MainCanvas.
  var KEYMAP = {
    left: 37,
    right: 39,
    up: 38,
    down: 40,
    jump: 32,
    enter: 13,
    escape: 27,
    pause: 80 // P: pause menu open (closed state) / resume (open state)
  };

  var AXIS_DEADZONE = 0.35;
  var TRIGGER_THRESHOLD = 0.25;

  // Jump-capable buttons (standard mapping): face + bumpers + triggers.
  var JUMP_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7];

  // Ruffle-only lookup with deliberately NO <object>/<embed> fallback:
  // on legacy browsers those elements are the real Flash plugin object,
  // which this script must never call into. Returns null there, making
  // every sendKey/click below a harmless no-op.
  function getPlayer() {
    try {
      return document.querySelector("#gameswf ruffle-player");
    } catch (e) {
      return null;
    }
  }

  // Same delivery pattern as touch-controls.js sendKey: element method
  // first, then the versioned ruffle() API. Best-effort throughout.
  function sendKey(type, code) {
    var method = type === "keydown" ? "tcKeyDown" : "tcKeyUp";
    var player = getPlayer();
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

  // Tap helper for menu keys (pause/escape): down then up. KEY_DOWN is
  // what the SWF acts on; the matching KEY_UP keeps keyPressState clean.
  function tapKey(code) {
    sendKey("keydown", code);
    setTimeout(function () {
      sendKey("keyup", code);
    }, 50);
  }

  // tcMode() is authoritative for click-gating (see touch-controls.js):
  // 2 == MainCanvas.MODE_FIELD (gameplay). Anything else (title, pause,
  // summary, -99 before init) may need a click to advance.
  function inGameField() {
    var player = getPlayer();
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
    for (var i = 0; i < cbs.length; i++) {
      try {
        if (typeof cbs[i].tcMode === "function") {
          if (cbs[i].tcMode() === 2) return true;
        }
      } catch (e) {
        /* try the next target */
      }
    }
    return false;
  }

  // Title/levelup screens advance on MouseEvent.CLICK inside the SWF.
  // Synthesize a press at the stage center on the Ruffle element; Ruffle
  // forwards DOM mouse events into Flash. Gated by inGameField() above.
  function clickPlayer() {
    var el = getPlayer();
    if (!el) return;
    var x = 0;
    var y = 0;
    try {
      var r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    } catch (e) {
      /* center is best-effort */
    }
    var seq = ["mousedown", "mouseup", "click"];
    for (var i = 0; i < seq.length; i++) {
      try {
        el.dispatchEvent(
          new MouseEvent(seq[i], {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0
          })
        );
      } catch (e) {
        /* older engines: fall through to element.click() */
      }
    }
    try {
      if (typeof el.click === "function") el.click();
    } catch (e) {
      /* click fallback is best-effort */
    }
  }

  function btnPressed(b) {
    if (!b) return false;
    if (typeof b.pressed === "boolean") return b.pressed;
    return (b.value || 0) > TRIGGER_THRESHOLD;
  }

  function axis(v) {
    return typeof v === "number" && isFinite(v) ? v : 0;
  }

  function init() {
    if (!("getGamepads" in navigator)) return;
    if (!document.getElementById("gameswf")) return;

    // Currently asserted SWF keys. Pulsed menu keys (pause/escape) are
    // NOT tracked here — tapKey() owns their full down/up cycle.
    var held = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      enter: false
    };
    var prevConfirm = false; // A(0): click edge for title screens
    var prevStart = false; // Start(9): pause tap + click edge
    var prevSelect = false; // Select(8): escape tap edge

    // Idle-loop guard: the 60fps poll runs only while at least one pad is
    // connected. gamepadconnected starts it (init also catches pads that
    // were already plugged in); the loop parks itself — releasing held
    // keys — once the last pad goes away. No pad, no polling.
    var useRaf = !!window.requestAnimationFrame;
    var looping = false;
    var timerId = 0;

    function setHeld(name, want) {
      if (want && !held[name]) {
        held[name] = true;
        sendKey("keydown", KEYMAP[name]);
      } else if (!want && held[name]) {
        held[name] = false;
        sendKey("keyup", KEYMAP[name]);
      }
    }

    function releaseAll() {
      for (var name in held) {
        if (held[name]) {
          held[name] = false;
          sendKey("keyup", KEYMAP[name]);
        }
      }
      prevConfirm = false;
      prevStart = false;
      prevSelect = false;
    }

    function anyPadConnected() {
      try {
        if (typeof navigator.getGamepads !== "function") return false;
        var pads = navigator.getGamepads();
        for (var i = 0; i < pads.length; i++) {
          if (pads[i] && pads[i].connected) return true;
        }
      } catch (e) {
        /* Gamepad API is best-effort */
      }
      return false;
    }

    function schedule() {
      if (useRaf) {
        timerId = window.requestAnimationFrame(poll);
      } else {
        timerId = setTimeout(poll, 16);
      }
    }

    function stopLoop() {
      looping = false;
      if (timerId) {
        try {
          if (useRaf && typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(timerId);
          } else {
            clearTimeout(timerId);
          }
        } catch (e) {
          /* cancel is best-effort */
        }
        timerId = 0;
      }
    }

    function maybeStart() {
      if (looping) return;
      if (!anyPadConnected()) return;
      looping = true;
      schedule();
    }

    function poll() {
      timerId = 0;
      if (!looping) return;
      try {
        var pads = navigator.getGamepads ? navigator.getGamepads() : [];
        var seen = false;
        var wantLeft = false;
        var wantRight = false;
        var wantUp = false;
        var wantDown = false;
        var wantJump = false;
        var confirm = false;
        var start = false;
        var select = false;

        for (var i = 0; i < pads.length; i++) {
          var gp = pads[i];
          if (!gp || !gp.connected) continue;
          seen = true;
          var b = gp.buttons || [];
          var ax = gp.axes || [];

          if (btnPressed(b[14]) || axis(ax[0]) < -AXIS_DEADZONE || axis(ax[2]) < -AXIS_DEADZONE) wantLeft = true;
          if (btnPressed(b[15]) || axis(ax[0]) > AXIS_DEADZONE || axis(ax[2]) > AXIS_DEADZONE) wantRight = true;
          if (btnPressed(b[12]) || axis(ax[1]) < -AXIS_DEADZONE || axis(ax[3]) < -AXIS_DEADZONE) wantUp = true;
          if (btnPressed(b[13]) || axis(ax[1]) > AXIS_DEADZONE || axis(ax[3]) > AXIS_DEADZONE) wantDown = true;

          for (var j = 0; j < JUMP_BUTTONS.length; j++) {
            if (btnPressed(b[JUMP_BUTTONS[j]])) {
              wantJump = true;
              break;
            }
          }
          if (btnPressed(b[0])) confirm = true;
          if (btnPressed(b[9])) start = true;
          if (btnPressed(b[8])) select = true;
        }

        // Last pad gone mid-loop: release keys and park until the next
        // gamepadconnected event. No idle polling.
        if (!seen) {
          releaseAll();
          stopLoop();
          return;
        }

        // Opposites cancel rather than stick (both sticks + dpad ORed).
        if (wantLeft && wantRight) {
          wantLeft = false;
          wantRight = false;
        }
        if (wantUp && wantDown) {
          wantUp = false;
          wantDown = false;
        }

        setHeld("left", wantLeft);
        setHeld("right", wantRight);
        setHeld("up", wantUp);
        setHeld("down", wantDown);
        setHeld("jump", wantJump);
        // A doubles as menu confirm (ENTER); jump (SPACE) rides along so
        // the same button works for gameplay and pause menus.
        setHeld("enter", confirm);

        // Rising edges: clicks + menu taps.
        if ((confirm && !prevConfirm) || (start && !prevStart)) {
          try {
            if (!inGameField()) clickPlayer();
          } catch (e) {
            /* click gate is best-effort */
          }
        }
        if (start && !prevStart) tapKey(KEYMAP.pause);
        if (select && !prevSelect) tapKey(KEYMAP.escape);
        prevConfirm = confirm;
        prevStart = start;
        prevSelect = select;
      } catch (e) {
        /* polling never throws */
      }
      if (looping) schedule();
    }

    window.addEventListener("gamepadconnected", maybeStart);
    window.addEventListener("gamepaddisconnected", function () {
      if (!anyPadConnected()) {
        releaseAll();
        stopLoop();
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) releaseAll();
    });
    window.addEventListener("blur", releaseAll);

    maybeStart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
