/*
 * Landing page behaviour: copy buttons, scroll reveals, sticky nav, and the
 * two-way demo.
 *
 * No framework and no build step — the page is three static files, so it can
 * be hosted anywhere that serves a folder.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------- copy -- */

  // Clipboard access can be refused (insecure origin, permissions policy), so
  // every copy falls back to selecting the text rather than failing silently.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("copy refused"));
    });
  }

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var original = btn.textContent;
    btn.addEventListener("click", function () {
      var target = document.querySelector(btn.getAttribute("data-copy"));
      if (!target) return;
      copyText(target.textContent.trim()).then(function () {
        btn.textContent = "Copied";
        btn.classList.add("is-done");
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("is-done");
        }, 1800);
      }).catch(function () {
        // Nothing was copied, so say so rather than claiming success.
        btn.textContent = "Select it";
        var r = document.createRange();
        r.selectNodeContents(target);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        setTimeout(function () { btn.textContent = original; }, 2200);
      });
    });
  });

  /* ----------------------------------------------------- reveal + nav -- */

  var nav = document.getElementById("nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("is-stuck", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  var rises = document.querySelectorAll(".rise");
  if (reduced || !("IntersectionObserver" in window)) {
    rises.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    rises.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------- demo -- */

  var log = document.getElementById("log");
  var filesEl = document.getElementById("files-laptop");
  var hint = document.getElementById("demo-hint");
  if (!log || !filesEl) return;

  var BASE_FILES = [
    { name: "README.md",    size: "1.2 KB" },
    { name: "package.json", size: "640 B"  },
    { name: "index.ts",     size: "2.1 KB" },
    { name: "src/boot.ts",  size: "880 B"  }
  ];

  var files = BASE_FILES.slice();
  var busy = false;
  var timers = [];

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function after(ms, fn) {
    timers.push(setTimeout(fn, reduced ? Math.min(ms, 80) : ms));
  }

  function drawFiles() {
    filesEl.innerHTML = "";
    files.forEach(function (f) {
      var row = document.createElement("div");
      row.className = "file" + (f.isNew ? " is-new" : "");
      row.innerHTML =
        '<span>' + f.name + '</span><span class="sz">' + f.size + "</span>";
      filesEl.appendChild(row);
    });
  }

  function say(text, cls) {
    var line = document.createElement("span");
    line.className = "line" + (cls ? " " + cls : "");
    line.textContent = text + "\n";
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function stamp() {
    var d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(function (n) { return String(n).padStart(2, "0"); })
      .join(":");
  }

  // Each action is a list of [delay, text, class] steps, plus an optional
  // side effect on the file list.
  var SCRIPTS = {
    edit: {
      hint: "A save on the Laptop reaches the Desktop before you look up.",
      steps: [
        [0,    "space atlas · change detected on Laptop", "dim"],
        [420,  "  index.ts  2.1 KB → 2.3 KB"],
        [760,  "  pushing to replica…", "dim"],
        [1180, "space atlas · IN-SYNC", "ok"]
      ]
    },
    push: {
      hint: "The push left from the Desktop, with the Desktop's credentials.",
      steps: [
        [0,    "exec · waiting for space atlas to converge", "dim"],
        [520,  "space atlas · IN-SYNC", "ok"],
        [820,  "exec · zsh -lc 'git push'  (cwd ~/projects/atlas)"],
        [1400, "  Enumerating objects: 7, done."],
        [1700, "  To github.com:you/atlas.git"],
        [1950, "     a1c3f90..4e21b8d  main -> main"],
        [2250, "exec · exit 0  ·  1.4s", "ok"]
      ]
    },
    tunnel: {
      hint: "Desktop's localhost:3000 now answers on your Laptop.",
      steps: [
        [0,    "ports · Laptop asked to reach Desktop:3000", "dim"],
        [460,  "  3000 already in use locally, remapping"],
        [820,  "tunnel open · Desktop:3000 → localhost:43000", "ok"],
        [1180, "  open http://localhost:43000 in your browser", "dim"]
      ]
    },
    drop: {
      hint: "The file landed in the Laptop's inbox — look at the left pane.",
      steps: [
        [0,   "transfer · sending build.zip to Laptop", "dim"],
        [600, "  4.1 MB  ·  chunked, resumable"],
        [1250, "transfer · delivered to ~/Ibeji/Inbox", "ok"]
      ],
      effect: function () {
        files = files.concat([
          { name: "~/Ibeji/Inbox/build.zip", size: "4.1 MB", isNew: true }
        ]);
        drawFiles();
      },
      effectAt: 1250
    },
    clip: {
      hint: "Copy on one Mac, paste on the other. Off by default.",
      steps: [
        [0,   "clipboard · 86 bytes copied on Desktop", "dim"],
        [520, "clipboard · available on Laptop", "ok"],
        [900, "  nothing is written to any log or history", "dim"]
      ]
    }
  };

  function run(key) {
    var script = SCRIPTS[key];
    if (!script || busy) return;
    busy = true;
    setButtons(true);

    if (hint) hint.textContent = "…";
    say("[" + stamp() + "]", "dim");

    var last = 0;
    script.steps.forEach(function (step) {
      last = Math.max(last, step[0]);
      after(step[0], function () { say("  " + step[1], step[2]); });
    });

    if (script.effect) {
      after(script.effectAt || last, script.effect);
    }

    after(last + 320, function () {
      if (hint) hint.textContent = script.hint;
      busy = false;
      setButtons(false);
    });
  }

  function setButtons(disabled) {
    document.querySelectorAll("[data-do]").forEach(function (b) {
      b.disabled = disabled;
    });
  }

  document.querySelectorAll("[data-do]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      run(btn.getAttribute("data-do"));
    });
  });

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      clearTimers();
      busy = false;
      setButtons(false);
      files = BASE_FILES.slice();
      drawFiles();
      log.innerHTML = "";
      say("daemon ready · paired with Laptop", "dim");
      if (hint) hint.textContent = "Pick an action on either side.";
    });
  }

  // First paint.
  drawFiles();
  say("daemon ready · paired with Laptop", "dim");
})();
