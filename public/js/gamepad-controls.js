/* Gamepad controls for the level player (/ and /play/:id).
 *
 * Sends key codes through the same tcKeyDown/tcKeyUp SWF hooks as
 * touch-controls.js. Standard-mapping pads; all connected pads are merged:
 *   d-pad (12-15) or either stick => arrows
 *   A/B/X/Y/LB/RB/LT/RT (0-7)     => Space (jump / select)
 *   A (0)                         => also Enter (pause-menu confirm)
 *   Start (9)                     => P (pause / resume)
 *   Select (8)                    => Escape (close pause menu)
 * Outside gameplay, A and Start also click the stage: the title screen only
 * advances on a mouse click.
 *
 * Only Ruffle's element is ever called, so under the real Flash plugin this
 * script is a no-op. Polling runs only while a pad is connected.
 */
(function () {
  "use strict";

  // The SWF's Utilities.KEY_*_INDEX values plus its menu keys.
  var KEYMAP = {
    left: 37,
    right: 39,
    up: 38,
    down: 40,
    jump: 32,
    enter: 13,
    escape: 27,
    pause: 80
  };

  var BUTTON = { confirm: 0, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  var JUMP_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7];
  var HELD_DIRECTIONS = ["left", "right", "up", "down", "jump"];

  var AXIS_DEADZONE = 0.35;
  var TRIGGER_THRESHOLD = 0.25;
  var MODE_FIELD = 2; // MainCanvas.MODE_FIELD: gameplay
  var TAP_MS = 50;
  var FALLBACK_POLL_MS = 16;

  // Ruffle replaces #gameswf with <ruffle-object> (<ruffle-player> on older
  // builds) or nests one inside it. A real Flash <object> never matches.
  function getPlayer() {
    var root = document.getElementById("gameswf");
    if (!root) return null;
    var tag = root.tagName.toLowerCase();
    if (tag === "ruffle-player" || tag === "ruffle-object") return root;
    return root.querySelector("ruffle-player, ruffle-object");
  }

  // The player element, then Ruffle's versioned API when it has one.
  function swfTargets() {
    var player = getPlayer();
    if (!player) return [];
    var targets = [player];
    try {
      var api = typeof player.ruffle === "function" && player.ruffle();
      if (api) targets.push(api);
    } catch (e) {
      // Older Ruffle builds have no versioned API.
    }
    return targets;
  }

  function sendKey(down, code) {
    var method = down ? "tcKeyDown" : "tcKeyUp";
    var targets = swfTargets();
    for (var i = 0; i < targets.length; i++) {
      try {
        if (typeof targets[i][method] === "function") {
          targets[i][method](code);
          return;
        }
      } catch (e) {
        // Fall through to the next target.
      }
    }
  }

  // The SWF acts on key-down; the key-up keeps its key state clean.
  function tapKey(code) {
    sendKey(true, code);
    setTimeout(function () {
      sendKey(false, code);
    }, TAP_MS);
  }

  function inGameField() {
    var targets = swfTargets();
    for (var i = 0; i < targets.length; i++) {
      try {
        if (typeof targets[i].tcMode === "function" && targets[i].tcMode() === MODE_FIELD) return true;
      } catch (e) {
        // Fall through to the next target.
      }
    }
    return false;
  }

  // Ruffle forwards DOM mouse events into the SWF.
  function clickPlayer(el) {
    var r = el.getBoundingClientRect();
    var init = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
      button: 0
    };
    ["mousedown", "mouseup", "click"].forEach(function (type) {
      el.dispatchEvent(new MouseEvent(type, init));
    });
    el.click();
  }

  // Gated on gameplay so a click can never interfere with play.
  function clickOutsideGameplay() {
    var el = getPlayer();
    if (!el || inGameField()) return;
    try {
      clickPlayer(el);
    } catch (e) {
      // Clicking is best-effort; the key taps still go through.
    }
  }

  function isPressed(button) {
    if (!button) return false;
    if (typeof button.pressed === "boolean") return button.pressed;
    return (button.value || 0) > TRIGGER_THRESHOLD;
  }

  function axisValue(v) {
    return typeof v === "number" && isFinite(v) ? v : 0;
  }

  // Axes 0/1 are the left stick, 2/3 the right stick.
  function stickPushed(axes, index, sign) {
    return sign * axisValue(axes[index]) > AXIS_DEADZONE || sign * axisValue(axes[index + 2]) > AXIS_DEADZONE;
  }

  function connectedPads() {
    try {
      var pads = navigator.getGamepads() || [];
      return Array.prototype.filter.call(pads, function (pad) {
        return pad && pad.connected;
      });
    } catch (e) {
      return [];
    }
  }

  function emptyInput() {
    return { connected: false, left: false, right: false, up: false, down: false, jump: false, confirm: false, start: false, select: false };
  }

  function mergePad(input, pad) {
    var b = pad.buttons || [];
    var axes = pad.axes || [];
    input.connected = true;
    input.left = input.left || isPressed(b[BUTTON.left]) || stickPushed(axes, 0, -1);
    input.right = input.right || isPressed(b[BUTTON.right]) || stickPushed(axes, 0, 1);
    input.up = input.up || isPressed(b[BUTTON.up]) || stickPushed(axes, 1, -1);
    input.down = input.down || isPressed(b[BUTTON.down]) || stickPushed(axes, 1, 1);
    input.jump = input.jump || JUMP_BUTTONS.some(function (i) { return isPressed(b[i]); });
    input.confirm = input.confirm || isPressed(b[BUTTON.confirm]);
    input.start = input.start || isPressed(b[BUTTON.start]);
    input.select = input.select || isPressed(b[BUTTON.select]);
  }

  function readInput() {
    var input = emptyInput();
    connectedPads().forEach(function (pad) {
      mergePad(input, pad);
    });
    // Opposite directions cancel instead of sticking.
    if (input.left && input.right) input.left = input.right = false;
    if (input.up && input.down) input.up = input.down = false;
    return input;
  }

  // Tracks held keys and button edges between polls.
  function createController() {
    var held = { left: false, right: false, up: false, down: false, jump: false, enter: false };
    var previous = emptyInput();

    function setHeld(name, want) {
      if (held[name] === want) return;
      held[name] = want;
      sendKey(want, KEYMAP[name]);
    }

    function releaseAll() {
      Object.keys(held).forEach(function (name) {
        setHeld(name, false);
      });
      previous = emptyInput();
    }

    // Enter rides along with A so one button covers gameplay and menus.
    function apply(input) {
      HELD_DIRECTIONS.forEach(function (name) {
        setHeld(name, input[name]);
      });
      setHeld("enter", input.confirm);
      var startPressed = input.start && !previous.start;
      if ((input.confirm && !previous.confirm) || startPressed) clickOutsideGameplay();
      if (startPressed) tapKey(KEYMAP.pause);
      if (input.select && !previous.select) tapKey(KEYMAP.escape);
      previous = input;
    }

    return { apply: apply, releaseAll: releaseAll };
  }

  function updateIndicator() {
    var el = document.getElementById("controller-indicator");
    if (el) el.style.display = connectedPads().length > 0 ? "block" : "none";
  }

  // Polls once per frame while any pad is connected, and parks (releasing
  // every key) once the last one leaves.
  function createPollLoop(controller) {
    var useRaf = typeof window.requestAnimationFrame === "function";
    var timerId = 0;

    function schedule() {
      timerId = useRaf ? window.requestAnimationFrame(tick) : setTimeout(tick, FALLBACK_POLL_MS);
    }

    function cancel() {
      if (!timerId) return;
      if (useRaf) window.cancelAnimationFrame(timerId);
      else clearTimeout(timerId);
      timerId = 0;
    }

    function park() {
      controller.releaseAll();
      cancel();
      updateIndicator();
    }

    function tick() {
      timerId = 0;
      var input = readInput();
      if (!input.connected) return park();
      try {
        controller.apply(input);
      } catch (e) {
        // A bad frame must not stop polling.
      }
      schedule();
    }

    function start() {
      updateIndicator();
      if (!timerId && connectedPads().length > 0) schedule();
    }

    function onDisconnect() {
      if (connectedPads().length === 0) park();
      else updateIndicator();
    }

    return { start: start, onDisconnect: onDisconnect };
  }

  function init() {
    if (!("getGamepads" in navigator) || !document.getElementById("gameswf")) return;
    var controller = createController();
    var loop = createPollLoop(controller);
    window.addEventListener("gamepadconnected", loop.start);
    window.addEventListener("gamepaddisconnected", loop.onDisconnect);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) controller.releaseAll();
    });
    window.addEventListener("blur", controller.releaseAll);
    loop.start();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
