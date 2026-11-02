// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// On-screen d-pad and jump button for the level player. Keys go straight
// into the game through the SWF's tcKeyDown/tcKeyUp hooks.
(function () {
  "use strict";

  var SPRITE = "/images/controls.png";
  var BASE_SIZE = 132; // d-pad px size that TRAVEL and DEADZONE are tuned for
  var TRAVEL = 16;
  var DEADZONE = 10;
  var MODE_FIELD = 2; // MainCanvas.MODE_FIELD: gameplay
  var PLAYING_POLL_MS = 500;

  var KEYMAP = { left: 37, right: 39, up: 38, down: 40, jump: 32 };

  var KNOB_DIRECTION = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1]
  };

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  var hooks = window.SwfHooks;
  var sendKey = hooks.sendKey;

  // tcInGame's boolean doesn't always survive Ruffle; tcMode does
  function isPlaying() {
    return hooks.call("tcInGame") === true || hooks.call("tcMode") === MODE_FIELD;
  }

  function watchPlaying(root) {
    function refresh() {
      root.classList.toggle("tc-playing", isPlaying());
    }
    refresh();
    setInterval(refresh, PLAYING_POLL_MS);
  }

  function createDpad(root, dpad, knob) {
    var held = null;

    function scale() {
      return dpad.clientWidth / BASE_SIZE || 1;
    }

    function release() {
      if (held) sendKey(false, KEYMAP[held]);
      held = null;
      root.removeAttribute("data-dir");
      knob.style.transform = "translate(0px,0px)";
    }

    function press(dir) {
      if (held === dir) return;
      release();
      held = dir;
      root.setAttribute("data-dir", dir);
      var travel = TRAVEL * scale();
      var offset = KNOB_DIRECTION[dir];
      knob.style.transform = "translate(" + offset[0] * travel + "px," + offset[1] * travel + "px)";
      sendKey(true, KEYMAP[dir]);
    }

    function directionAt(x, y) {
      var r = dpad.getBoundingClientRect();
      var dx = x - (r.left + r.width / 2);
      var dy = y - (r.top + r.height / 2);
      if (Math.sqrt(dx * dx + dy * dy) < DEADZONE * scale()) return null;
      if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
      return dy < 0 ? "up" : "down";
    }

    function aim(x, y) {
      var dir = directionAt(x, y);
      if (dir) press(dir);
      else release();
    }

    return { start: aim, move: aim, end: release };
  }

  function createJumpButton(root) {
    return {
      start: function () {
        root.setAttribute("data-jump", "1");
        sendKey(true, KEYMAP.jump);
      },
      move: function () {},
      end: function () {
        root.removeAttribute("data-jump");
        sendKey(false, KEYMAP.jump);
      }
    };
  }

  function createGesture(handlers) {
    var active = null;
    return {
      start: function (id, x, y) {
        if (active !== null) return false;
        active = id;
        handlers.start(x, y);
        return true;
      },
      move: function (id, x, y) {
        if (id !== active) return false;
        handlers.move(x, y);
        return true;
      },
      end: function (id) {
        if (id !== active) return;
        active = null;
        handlers.end();
      },
      cancel: function () {
        if (active === null) return;
        active = null;
        handlers.end();
      }
    };
  }

  function pointerId(e) {
    return e.pointerId !== undefined ? e.pointerId : "touch";
  }

  function capturePointer(el, id) {
    try {
      el.setPointerCapture(id);
    } catch (e) {
      // synthetic pointers can't be captured
    }
  }

  function bindPointerEvents(el, gesture, options) {
    if (!window.PointerEvent) return;
    el.addEventListener("pointerdown", function (e) {
      var started = gesture.start(pointerId(e), e.clientX, e.clientY);
      if (started && options.capturePointer) capturePointer(el, e.pointerId);
      e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) {
      if (gesture.move(pointerId(e), e.clientX, e.clientY)) e.preventDefault();
    });
    function end(e) {
      gesture.end(pointerId(e));
      e.preventDefault();
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function eachChangedTouch(e, fn) {
    for (var i = 0; i < e.changedTouches.length; i++) fn(e.changedTouches[i]);
    e.preventDefault();
  }

  function bindTouchEvents(el, gesture) {
    var opts = { passive: false };
    el.addEventListener("touchstart", function (e) {
      var t = e.changedTouches[0];
      gesture.start(t.identifier, t.clientX, t.clientY);
      e.preventDefault();
    }, opts);
    el.addEventListener("touchmove", function (e) {
      eachChangedTouch(e, function (t) {
        gesture.move(t.identifier, t.clientX, t.clientY);
      });
    }, opts);
    function end(e) {
      eachChangedTouch(e, function (t) {
        gesture.end(t.identifier);
      });
    }
    el.addEventListener("touchend", end, opts);
    el.addEventListener("touchcancel", end, opts);
  }

  // Pointer and touch events are both bound; whichever arrives first wins,
  // so taps register immediately everywhere.
  function bindControl(el, handlers, options) {
    var gesture = createGesture(handlers);
    bindPointerEvents(el, gesture, options);
    bindTouchEvents(el, gesture);
    if (options.releaseOnMouseLeave) {
      el.addEventListener("pointerleave", function (e) {
        if (e.pointerType === "mouse") gesture.cancel();
      });
    }
    return gesture.cancel;
  }

  function releaseOnHide(releases) {
    function releaseAll() {
      releases.forEach(function (release) {
        release();
      });
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) releaseAll();
    });
    window.addEventListener("blur", releaseAll);
  }

  function init() {
    if (!isTouchDevice()) return;
    var root = document.getElementById("touch-controls");
    if (!root || !document.getElementById("gamecontainer")) return;
    new Image().src = SPRITE; // Preload so the first touch never shows unstyled.
    root.classList.add("tc-on");
    var dpad = root.querySelector(".tc-dpad");
    var knob = root.querySelector(".tc-knob");
    if (!dpad || !knob) return;
    watchPlaying(root);
    var releases = [
      bindControl(dpad, createDpad(root, dpad, knob), { capturePointer: true, releaseOnMouseLeave: true })
    ];
    var jumpButton = root.querySelector(".tc-btn");
    if (jumpButton) releases.push(bindControl(jumpButton, createJumpButton(root), {}));
    releaseOnHide(releases);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
