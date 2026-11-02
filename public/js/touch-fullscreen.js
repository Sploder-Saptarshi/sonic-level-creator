// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

/* Fullscreen game stage for touch devices (Sonic player + Ice Shuffle).
 *
 * On touch-capable devices only, a touch inside #gameswf requests native
 * fullscreen on #gamecontainer (styling in touch-fullscreen.css: black
 * letterboxed stage). There is deliberately NO fallback: a denied or
 * missing grant is silently ignored and the next touch simply retries,
 * so a half-applied stage can never exist.
 * Desktop is untouched: no listeners do anything without touch.
 *
 * Listeners use window capture phase: the Ruffle player may stop
 * propagation on touch events (the game still gets them), which would
 * swallow bubble-phase listeners on #gameswf.
 *
 * Stage state is mirrored to a `tc-stage-fullscreen` class on the
 * container (set from fullscreenchange events), which is what reveals
 * the touch controls — never the :fullscreen selector alone.
 */
(function () {
  "use strict";

  function isTouchDevice() {
    if ("ontouchstart" in window) return true;
    if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) return true;
    if (typeof navigator !== "undefined" && navigator.msMaxTouchPoints > 0) return true;
    return false;
  }

  function init() {
    var touch = isTouchDevice();
    var container = document.getElementById("gamecontainer");
    var swf = document.getElementById("gameswf");
    if (!touch) return;
    if (!container || !swf) return;

    var exitBtn = null;
    var entering = false; // request in flight: swallow duplicate gestures

    // Natural SWF size. The player renders noscale, so fullscreen scaling
    // is a CSS transform on the stage: largest factor that still fits.
    // Ice Shuffle crops the movie through a 600x444 window (20px shaved
    // off each side, 2px off top/bottom); detect that setup so fullscreen
    // preserves the crop instead of revealing the hidden edges.
    var GAME_W = 640;
    var GAME_H = 448;

    function detectCrop() {
      var cropped = false;
      try {
        if (swf.clientWidth > container.clientWidth + 1) cropped = true;
      } catch (e) {
        cropped = false;
      }
      GAME_W = cropped ? 600 : 640;
      GAME_H = cropped ? 444 : 448;
      try {
        if (cropped) container.classList.add("tc-cropped");
        else container.classList.remove("tc-cropped");
      } catch (e) {
        /* class toggle is best-effort */
      }
    }

    // Fit the fixed-size stage into the viewport via transform scale.
    // Origin center (see CSS) keeps it centered under flex layout.
    function fit() {
      if (!isFull()) return;
      var s = Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H);
      if (!isFinite(s) || s <= 0) s = 1;
      swf.style.transform = "scale(" + s + ")";
    }

    function unfit() {
      swf.style.transform = "";
    }

    // Viewport dims can lag a frame (or more) behind the fullscreenchange
    // event — e.g. URL-bar hide/show only fires visualViewport resizes.
    // Refit on the next frame plus a delayed retry; fit() no-ops unless
    // still fullscreen, so this is safe to schedule liberally.
    function refitSoon() {
      try {
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(function () {
            fit();
          });
        }
      } catch (e) {
        /* rAF is best-effort */
      }
      setTimeout(function () {
        fit();
      }, 250);
    }

    function isFull() {
      if (document.fullscreenElement === container) return true;
      if (document.webkitFullscreenElement === container) return true;
      return false;
    }

    // Whatever element holds fullscreen (our container, the whole page,
    // …), the stage counts as visible when that subtree includes our
    // container — i.e. the game is on screen in fullscreen.
    function fsRoot() {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function stageVisible() {
      var root = fsRoot();
      if (!root) return false;
      if (root === container) return true;
      try {
        return !!root.contains && root.contains(container);
      } catch (e) {
        return false;
      }
    }

    function showExit(show) {
      if (!exitBtn) return;
      exitBtn.style.display = show ? "block" : "none";
    }

    // Mirror stage state for the touch-controls visibility gate.
    // Also flag the document so page chrome (flags, feedback tab) can be
    // hidden while the stage owns the screen.
    function syncStage() {
      var full = isFull() || stageVisible();
      if (full) container.classList.add("tc-stage-fullscreen");
      else container.classList.remove("tc-stage-fullscreen");
      try {
        if (document.documentElement) {
          if (full) document.documentElement.classList.add("tc-stage-active");
          else document.documentElement.classList.remove("tc-stage-active");
        }
      } catch (e) {
        /* chrome hiding is best-effort */
      }
      showExit(full);
      entering = false;
      if (full) {
        fit();
        refitSoon();
        lockLandscape();
      } else {
        unfit();
        unlockOrientation();
      }
    }

    // Rotate to landscape automatically while staged. Needs real
    // fullscreen on supporting browsers; best-effort everywhere else.
    function lockLandscape() {
      try {
        var o = window.screen && window.screen.orientation;
        if (o && typeof o.lock === "function") {
          var p = o.lock("landscape");
          if (p && typeof p.catch === "function") {
            p.catch(function () {
              /* orientation lock is best-effort */
            });
          }
        }
      } catch (e) {
        /* orientation lock is best-effort */
      }
    }

    function unlockOrientation() {
      try {
        var o = window.screen && window.screen.orientation;
        if (o && typeof o.unlock === "function") o.unlock();
      } catch (e) {
        /* orientation unlock is best-effort */
      }
    }

    function ensureExitBtn() {
      if (exitBtn) return exitBtn;
      exitBtn = document.createElement("button");
      exitBtn.className = "tc-exit-fullscreen";
      exitBtn.textContent = "";
      exitBtn.setAttribute("aria-label", "Exit fullscreen");
      exitBtn.setAttribute("type", "button");
      exitBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        exit();
      });
      exitBtn.addEventListener("pointerdown", function (e) {
        e.stopPropagation();
      });
      exitBtn.addEventListener(
        "touchstart",
        function (e) {
          e.stopPropagation();
        },
        { passive: true }
      );
      container.appendChild(exitBtn);
      return exitBtn;
    }

    function enter() {
      if (isFull() || entering) return;
      var req = container.requestFullscreen || container.webkitRequestFullscreen;
      // No Fullscreen API: silently ignore until a grant happens — every
      // touch retries, nothing half-applies.
      if (!req) return;
      // Fire the request FIRST, synchronously on gesture entry, before any
      // DOM work or layout reads: some engines (Firefox Mobile) only honor
      // requests issued at the very top of a short-running gesture handler.
      entering = true;
      try {
        var r = req.call(container);
        if (r && typeof r.catch === "function") {
          r.catch(function () {
            entering = false;
          });
        }
      } catch (e) {
        entering = false;
        return;
      }
      ensureExitBtn();
      detectCrop();
      // If the grant never arrives (denied without rejection, lost
      // gesture, browser quirk), just unlock for the next touch. Never
      // fall back: a failed request leaves zero trace.
      setTimeout(function () {
        entering = false;
      }, 800);
    }

    function exit() {
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen && document.webkitFullscreenElement) {
          document.webkitExitFullscreen();
        }
      } catch (e) {
        /* exit is best-effort */
      }
      entering = false;
      syncStage();
    }

    document.addEventListener("fullscreenchange", syncStage);
    document.addEventListener("webkitfullscreenchange", syncStage);
    // Refit on viewport changes (rotation, split-screen, URL bar).
    // visualViewport.resize covers URL-bar show/hide, which does not
    // always fire a window resize.
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", fit);
      }
    } catch (e) {
      /* visualViewport is best-effort */
    }
    // Denial is silent: reset for the next touch, apply nothing.
    document.addEventListener("fullscreenerror", function () {
      entering = false;
    });
    document.addEventListener("webkitfullscreenerror", function () {
      entering = false;
    });

    function inside(e) {
      var t = e.target;
      if (!t) return false;
      try {
        return container.contains(t);
      } catch (err) {
        return false;
      }
    }

    // Long-press must never raise a context menu (touch right-click).
    container.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    // Capture phase on window: runs before anything inside the SWF/Ruffle
    // player can stop propagation. Desktop mouse is ignored, as are
    // synthetic (untrusted) events. touchend gets its own shot: some
    // engines only honor the request at a particular point in the gesture,
    // and activation is still valid at gesture end. While staged, every
    // gesture re-attempts the landscape lock (some engines only honor it
    // inside a genuine gesture, not from fullscreenchange).
    window.addEventListener(
      "touchstart",
      function (e) {
        if (e.isTrusted === false) return;
        if (!inside(e)) return;
        enter();
        if (isFull()) lockLandscape();
      },
      { capture: true, passive: true }
    );
    window.addEventListener(
      "touchend",
      function (e) {
        if (e.isTrusted === false) return;
        if (inside(e)) enter();
      },
      { capture: true, passive: true }
    );
    if (window.PointerEvent) {
      window.addEventListener(
        "pointerdown",
        function (e) {
          if (e.isTrusted === false) return;
          if ((e.pointerType === "touch" || e.pointerType === "pen") && inside(e)) {
            enter();
          }
        },
        { capture: true }
      );
    }

    // Pick up a stage that is already fullscreen (e.g. entered before
    // this script ran).
    detectCrop();
    syncStage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
