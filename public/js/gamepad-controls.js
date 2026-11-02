// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Gamepad support for the level player, through the same SWF hooks as
// touch-controls.js. D-pad/sticks = arrows, face buttons and triggers = jump,
// A = Enter, Start = P (pause), Select = Escape.
(function () {
  "use strict";

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
  var MODE_FIELD = 2; // MainCanvas.MODE_FIELD: gameplay
  var TAP_MS = 50;

  var hooks = window.SwfHooks;
  var sendKey = hooks.sendKey;

  function tapKey(code) {
    sendKey(true, code);
    setTimeout(function () {
      sendKey(false, code);
    }, TAP_MS);
  }

  function inGameField() {
    return hooks.call("tcMode") === MODE_FIELD;
  }

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

  // the title screen only advances on a mouse click
  function clickOutsideGameplay() {
    var el = hooks.getPlayer();
    if (el && !inGameField()) clickPlayer(el);
  }

  function isPressed(button) {
    return !!button && button.pressed;
  }

  // axes 0/1: left stick, 2/3: right stick
  function stickPushed(axes, index, sign) {
    return sign * axes[index] > AXIS_DEADZONE || sign * axes[index + 2] > AXIS_DEADZONE;
  }

  function connectedPads() {
    return Array.prototype.filter.call(navigator.getGamepads(), function (pad) {
      return pad && pad.connected;
    });
  }

  function emptyInput() {
    return { connected: false, left: false, right: false, up: false, down: false, jump: false, confirm: false, start: false, select: false };
  }

  function mergePad(input, pad) {
    var b = pad.buttons;
    var axes = pad.axes;
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
    if (input.left && input.right) input.left = input.right = false;
    if (input.up && input.down) input.up = input.down = false;
    return input;
  }

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

  function createPollLoop(controller) {
    var frame = 0;

    function park() {
      controller.releaseAll();
      cancelAnimationFrame(frame);
      frame = 0;
      updateIndicator();
    }

    function tick() {
      frame = 0;
      var input = readInput();
      if (!input.connected) return park();
      controller.apply(input);
      frame = requestAnimationFrame(tick);
    }

    function start() {
      updateIndicator();
      if (!frame && connectedPads().length > 0) frame = requestAnimationFrame(tick);
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
