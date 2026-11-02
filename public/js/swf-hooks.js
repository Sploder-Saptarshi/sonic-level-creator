// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Calls into the game SWF's ExternalInterface hooks (tcKeyDown, tcMode, ...).
// Shared by touch-controls.js and gamepad-controls.js.
window.SwfHooks = (function () {
  "use strict";

  // Ruffle swaps #gameswf for its own element (or nests one inside it).
  function getPlayer() {
    var root = document.getElementById("gameswf");
    if (!root) return null;
    if (/^ruffle-(player|object)$/i.test(root.tagName)) return root;
    return root.querySelector("ruffle-player, ruffle-object");
  }

  // the hooks only exist once the movie has registered them
  function call(method) {
    var player = getPlayer();
    if (!player || typeof player[method] !== "function") return undefined;
    try {
      return player[method].apply(player, Array.prototype.slice.call(arguments, 1));
    } catch (e) {
      return undefined;
    }
  }

  function sendKey(down, code) {
    call(down ? "tcKeyDown" : "tcKeyUp", code);
  }

  return { getPlayer: getPlayer, call: call, sendKey: sendKey };
})();
