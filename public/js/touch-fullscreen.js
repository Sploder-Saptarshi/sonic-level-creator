/* Fullscreen game stage for touch devices (Sonic player + Ice Shuffle).
 *
 * On touch-capable devices only, a touch inside #gameswf fullscreenes
 * #gamecontainer (styling in touch-fullscreen.css: black letterboxed
 * stage). Where the Fullscreen API is missing (e.g. iPhone Safari) a
 * fixed-position pseudo stage is used instead, with an exit button.
 * Desktop is untouched: no listeners do anything without touch.
 *
 * Listeners use window capture phase: the Ruffle player may stop
 * propagation on touch events (the game still gets them), which would
 * swallow bubble-phase listeners on #gameswf.
 *
 * Stage state is mirrored to a `tc-stage-fullscreen` class on the
 * container (set from fullscreenchange events + the pseudo path), which
 * is what reveals the touch controls — never the :fullscreen selector
 * alone. window.__tcState() reports the live state for debugging.
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
    // Debug snapshot (safe to call even when inert).
    window.__tcState = function () {
      var root = null;
      try {
        root = fsRoot();
      } catch (e) {
        root = null;
      }
      var controls = document.getElementById("touch-controls");
      var sheets = [];
      try {
        for (var i = 0; i < document.styleSheets.length; i++) {
          sheets.push(document.styleSheets[i].href || "(inline)");
        }
      } catch (e) {
        sheets.push("unreadable");
      }
      var cd = null;
      var baseBg = null;
      try {
        if (controls && window.getComputedStyle) {
          var cs = window.getComputedStyle(controls);
          cd = cs.display + "/" + cs.visibility + "/z" + cs.zIndex +
            "/" + controls.getBoundingClientRect().width + "x" +
            controls.getBoundingClientRect().height;
          var base = controls.querySelector(".tc-base");
          if (base) baseBg = window.getComputedStyle(base).backgroundImage;
        }
      } catch (e) {
        cd = "unreadable";
      }
      return {
        touch: touch,
        container: !!container,
        controlsMarkup: !!controls,
        controlsOn: !!controls && controls.classList.contains("tc-on"),
        controlsComputed: cd,
        baseBackground: baseBg,
        spriteProbe: window.__tcImg,
        stylesheets: sheets,
        fullscreenElement: document.fullscreenElement === container,
        webkitFullscreenElement: document.webkitFullscreenElement === container,
        fsTag: root ? root.tagName || "?" : null,
        fsContainsStage: !!root && root !== container &&
          !!(root.contains && root.contains(container)),
        pseudo: !!container && container.classList.contains("tc-pseudo-fullscreen"),
        stage: !!container && container.classList.contains("tc-stage-fullscreen")
      };
    };
    if (!touch) return;
    if (!container || !swf) return;

    var exitBtn = null;
    var entering = false; // request in flight: swallow duplicate gestures

    // Natural SWF size. The player renders noscale, so fullscreen scaling
    // is a CSS transform on the stage: largest factor that still fits.
    var GAME_W = 640;
    var GAME_H = 448;

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

    // Probe the control sprite: result lands in window.__tcImg.
    window.__tcImg = "pending";
    try {
      var probe = new Image();
      probe.onload = function () {
        window.__tcImg = "ok " + probe.naturalWidth + "x" + probe.naturalHeight;
      };
      probe.onerror = function () {
        window.__tcImg = "error";
      };
      probe.src = "/images/controls.png";
    } catch (e) {
      window.__tcImg = "error";
    }

    function isFull() {
      if (document.fullscreenElement === container) return true;
      if (document.webkitFullscreenElement === container) return true;
      return container.classList.contains("tc-pseudo-fullscreen");
    }

    // Whatever element holds fullscreen (our container, the whole page,
    // …), the stage counts as visible when that subtree includes our
    // container — i.e. the game is on screen in fullscreen.
    function fsRoot() {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function stageVisible() {
      if (container.classList.contains("tc-pseudo-fullscreen")) return true;
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
    function syncStage() {
      var full = isFull() || stageVisible();
      if (full) container.classList.add("tc-stage-fullscreen");
      else container.classList.remove("tc-stage-fullscreen");
      showExit(full);
      entering = false;
      if (full) fit();
      else unfit();
    }

    function ensureExitBtn() {
      if (exitBtn) return exitBtn;
      exitBtn = document.createElement("button");
      exitBtn.className = "tc-exit-fullscreen";
      exitBtn.textContent = "\u00d7";
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

    function pseudo() {
      if (isFull()) {
        syncStage();
        return;
      }
      container.classList.add("tc-pseudo-fullscreen");
      if (document.body) document.body.classList.add("tc-locked");
      entering = false;
      syncStage();
    }

    function enter() {
      if (isFull() || entering) return;
      ensureExitBtn();
      var req = container.requestFullscreen || container.webkitRequestFullscreen;
      if (!req) {
        pseudo();
        return;
      }
      entering = true;
      var r = null;
      try {
        r = req.call(container);
      } catch (e) {
        pseudo();
        return;
      }
      if (r && typeof r.catch === "function") {
        r.catch(function () {
          entering = false;
          pseudo();
        });
      } else {
        // No promise to observe (older webkit): check shortly whether
        // the request took, otherwise fall back.
        setTimeout(function () {
          if (!isFull()) pseudo();
          else syncStage();
        }, 350);
      }
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
      if (container.classList.contains("tc-pseudo-fullscreen")) {
        container.classList.remove("tc-pseudo-fullscreen");
        if (document.body) document.body.classList.remove("tc-locked");
      }
      entering = false;
      syncStage();
    }

    document.addEventListener("fullscreenchange", syncStage);
    document.addEventListener("webkitfullscreenchange", syncStage);
    // Refit on viewport changes (rotation, split-screen, URL bar).
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    // Some browsers report denial via event instead of promise rejection.
    document.addEventListener("fullscreenerror", function () {
      entering = false;
      pseudo();
    });
    document.addEventListener("webkitfullscreenerror", function () {
      entering = false;
      pseudo();
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

    // Capture phase on window: runs before anything inside the SWF/Ruffle
    // player can stop propagation. Desktop mouse is ignored.
    window.addEventListener(
      "touchstart",
      function (e) {
        if (inside(e)) enter();
      },
      { capture: true, passive: true }
    );
    if (window.PointerEvent) {
      window.addEventListener(
        "pointerdown",
        function (e) {
          if ((e.pointerType === "touch" || e.pointerType === "pen") && inside(e)) {
            enter();
          }
        },
        { capture: true }
      );
    }

    // Pick up a stage that is already fullscreen (e.g. entered before
    // this script ran).
    syncStage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
