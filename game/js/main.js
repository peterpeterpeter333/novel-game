/* 没入書庫 起動処理・書庫画面 */

(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function buildLibrary() {
    var lib = document.getElementById("library");
    var saved = NG.savedPos();
    var html = "<h1>没 入 書 庫</h1>";
    lib.innerHTML = html;

    Object.keys(NG.scenarios).forEach(function (id) {
      var s = NG.scenarios[id];
      var card = document.createElement("div");
      card.className = "book";
      card.innerHTML =
        '<div class="bt">' + esc(s.title) + "</div>" +
        '<div class="bs">' + esc(s.sub || "") + "</div>" +
        '<div class="bd">' + esc(s.desc || "") + "</div>" +
        '<div class="bookbtns"></div>';
      var btns = card.querySelector(".bookbtns");

      var startBtn = document.createElement("button");
      startBtn.className = "ch";
      startBtn.textContent = "はじめから";
      startBtn.onclick = function (e) {
        e.stopPropagation();
        NG.clearSave();
        NG.start(id);
      };
      btns.appendChild(startBtn);

      if (saved && saved.s === id) {
        var contBtn = document.createElement("button");
        contBtn.className = "ch";
        contBtn.textContent = "続きから";
        contBtn.onclick = function (e) {
          e.stopPropagation();
          NG.start(id, saved.n);
        };
        btns.appendChild(contBtn);
      }
      lib.appendChild(card);
    });

    var locked = document.createElement("div");
    locked.className = "book locked";
    locked.innerHTML =
      '<div class="bt">――</div>' +
      '<div class="bs">準備中</div>' +
      '<div class="bd">次の物語が、ここに並ぶ。</div>';
    lib.appendChild(locked);
  }

  function init() {
    NG.boot();
    buildLibrary();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
