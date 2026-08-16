/* 没入書庫 エンジン（作品非依存）
   シナリオは NG.register({...}) で登録する。 */

window.NG = (function () {
  "use strict";

  /* ---------- 保存（localStorage 不可の環境ではメモリに退避） ---------- */
  var mem = {};
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };

  var reduced = false;
  try { reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* ---------- 状態 ---------- */
  var scenarios = {};
  var cur = null;          // 実行中シナリオ
  var nodeId = null;
  var typing = null;       // {skip:bool}
  var tapResolver = null;
  var busy = false;

  var T = null;            // テレメトリ

  function resetTelemetry() {
    T = { start: Date.now(), choices: [], diaries: [], hints: 0 };
  }

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }
  var flow, controls, fx, hud;

  function scrollDown() { flow.scrollTop = flow.scrollHeight; }

  function clearFlow() { flow.innerHTML = ""; }
  function clearControls() { controls.innerHTML = ""; }

  /* ---------- 行の描画 ---------- */
  function clsFor(t) {
    if (t.charAt(0) === "【") return "sys";
    if (t.charAt(0) === "「" || t.charAt(0) === "『") return "say";
    return "nar";
  }

  function addLineNow(text, cls) {
    var d = document.createElement("div");
    d.className = "line " + (cls || clsFor(text));
    d.textContent = text;
    flow.appendChild(d);
    scrollDown();
    return d;
  }

  function typeLine(text, cls) {
    return new Promise(function (res) {
      var d = document.createElement("div");
      d.className = "line " + (cls || clsFor(text));
      flow.appendChild(d);
      if (reduced) { d.textContent = text; scrollDown(); res(); return; }
      var i = 0;
      typing = { skip: false };
      var iv = setInterval(function () {
        if (typing && typing.skip) {
          d.textContent = text;
          clearInterval(iv); typing = null; scrollDown(); res(); return;
        }
        i += 1;
        d.textContent = text.slice(0, i);
        if (i % 6 === 0) scrollDown();
        if (i >= text.length) { clearInterval(iv); typing = null; scrollDown(); res(); }
      }, 26);
    });
  }

  function waitTap() {
    return new Promise(function (res) {
      var cue = document.createElement("div");
      cue.className = "cue";
      cue.textContent = "▼";
      flow.appendChild(cue);
      scrollDown();
      tapResolver = function () { cue.remove(); res(); };
    });
  }

  function onTap() {
    if (typing) { typing.skip = true; return; }
    if (tapResolver) { var r = tapResolver; tapResolver = null; r(); }
  }

  async function playLines(lines) {
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var text = (typeof ln === "string") ? ln : ln.t;
      var cls = (typeof ln === "string") ? null : ln.c;
      await typeLine(text, cls);
      if (i < lines.length - 1) await waitTap();
    }
  }

  /* ---------- モード遷移 ---------- */
  var mode = null;
  function setModeInstant(m) {
    mode = m;
    document.body.className = "mode-" + m;
  }
  function transition(m, msg) {
    return new Promise(function (res) {
      if (mode === m) { res(); return; }
      if (reduced) { setModeInstant(m); res(); return; }
      fx.textContent = msg || "";
      fx.classList.add("on");
      setTimeout(function () {
        setModeInstant(m);
        clearFlow();
        setTimeout(function () {
          fx.classList.remove("on");
          res();
        }, 500);
      }, msg ? 1150 : 400);
    });
  }
  var FXMSG = {
    kabe: "未登録網に接続しています ……",
    kiko: "機構統合端末に再接続しています ……",
    plain: ""
  };

  /* ---------- ノード実行 ---------- */
  async function runNode(id) {
    var n = cur.nodes[id];
    if (!n) { addLineNow("【シナリオエラー: ノード " + id + " が見つかりません】", "sys"); return; }
    nodeId = id;
    if (!n.noSave) store.set("ng-pos", JSON.stringify({ s: cur.id, n: id }));

    clearControls();
    if (n.mode && n.mode !== mode) await transition(n.mode, FXMSG[n.mode]);
    if (n.clear) clearFlow();

    var fn = types[n.type || "text"];
    await fn(n);
  }

  function choiceButtons(list, onPick) {
    var t0 = performance.now();
    list.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "ch";
      b.textContent = c.label;
      b.onclick = function () {
        if (busy) return;
        busy = true;
        clearControls();
        var ms = performance.now() - t0;
        onPick(c, ms).then(function () { busy = false; });
      };
      controls.appendChild(b);
    });
  }

  var types = {

    /* 表紙 */
    title: async function (n) {
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="t2">' + esc(n.sub || "") + "</div>" +
        '<div class="t1">' + esc(n.t) + "</div>" +
        '<div class="t3">' + esc(n.note || "") + "</div>";
      flow.appendChild(card);
      choiceButtons([{ label: n.button || "開く", next: n.next }], async function (c) {
        await runNode(c.next);
      });
    },

    /* 地の文 */
    text: async function (n) {
      await playLines(n.lines);
      if (n.next) { await waitTap(); await runNode(n.next); }
    },

    /* 選択肢（reply でラリーにも使う） */
    choice: async function (n) {
      await playLines(n.lines || []);
      choiceButtons(n.choices, async function (c, ms) {
        T.choices.push({ node: nodeId, label: c.label, ms: Math.round(ms) });
        if (!c.silent) addLineNow(c.label, "me");
        if (c.reply) { await playLines(c.reply); }
        await waitTap();
        await runNode(c.next || n.next);
      });
    },

    /* 情動ログ入力 */
    diary: async function (n) {
      await playLines(n.lines || []);
      var t0 = performance.now();
      var box = document.createElement("div");
      box.className = "diary";
      box.innerHTML =
        '<div class="dlabel">' + esc(n.label || "【本日の情動ログを提出してください】") + "</div>" +
        '<textarea spellcheck="false"></textarea>' +
        '<div class="dnote">推奨文が入力されています。このまま提出できます。</div>';
      var ta = box.querySelector("textarea");
      ta.value = n.suggest;
      controls.appendChild(box);
      var b = document.createElement("button");
      b.className = "ch";
      b.textContent = "提出";
      b.style.marginTop = "9px";
      controls.appendChild(b);
      await new Promise(function (res) {
        b.onclick = function () {
          var ms = Math.round(performance.now() - t0);
          var edited = ta.value.trim() !== n.suggest.trim();
          T.diaries.push({ node: nodeId, edited: edited, ms: ms });
          clearControls();
          addLineNow("【" + ta.value.trim() + "】", "me");
          addLineNow(edited ? "【提出を受理しました】" : "【提出を受理しました（入力時間 " + (ms / 1000).toFixed(1) + " 秒）】", "sys");
          res();
        };
      });
      await waitTap();
      await runNode(n.next);
    },

    /* ログ調査: target の行を開くと先に進める */
    logview: async function (n) {
      await playLines(n.lines || []);
      var opens = 0, found = false;
      var rowEls = {};
      n.items.forEach(function (it) {
        var b = document.createElement("button");
        b.className = "logrow" + (it.gray ? " gray" : "");
        rowEls[it.key] = b;
        b.innerHTML = '<span class="t">' + esc(it.time) + "</span><span>" + esc(it.label) + "</span>";
        var det = null;
        b.onclick = function () {
          if (det) { det.remove(); det = null; b.classList.remove("open"); return; }
          det = document.createElement("div");
          det.className = "logdetail";
          det.textContent = it.d;
          b.after(det);
          b.classList.add("open");
          if (it.key === n.target && !found) {
            found = true;
            var go = document.createElement("button");
            go.className = "ch";
            go.style.marginTop = "9px";
            go.textContent = n.goLabel || "この空白を調べる";
            go.onclick = async function () {
              clearControls();
              await runNode(n.next);
            };
            controls.appendChild(go);
          } else if (!found) {
            opens += 1;
            if (opens === n.hintAfter) {
              T.hints += 1;
              addLineNow(n.hint, "say");
              if (rowEls[n.target]) rowEls[n.target].classList.add("hint");
            }
          }
        };
        controls.appendChild(b);
      });
    },

    /* 証言比較: 正解を選ぶまで問い直す */
    testimony: async function (n) {
      n.quotes.forEach(function (q) {
        var d = document.createElement("div");
        d.className = "quote";
        d.innerHTML = '<div class="who">' + esc(q.who) + "</div>" + esc(q.t);
        flow.appendChild(d);
      });
      scrollDown();
      await playLines(n.lines || []);
      var attempts = 0;
      var ask = function () {
        choiceButtons(n.choices, async function (c, ms) {
          T.choices.push({ node: nodeId, label: c.label, ms: Math.round(ms) });
          addLineNow(c.label, "me");
          if (c.ok) {
            await waitTap();
            await runNode(n.next);
          } else {
            attempts += 1;
            await playLines(c.reply);
            ask();
          }
        });
      };
      ask();
    },

    /* プレイヤー観測記録の開示 */
    stats: async function (n) {
      var secs = Math.round((Date.now() - T.start) / 1000);
      var mm = Math.floor(secs / 60), ss = secs % 60;
      var cs = T.choices;
      var avg = cs.length ? cs.reduce(function (a, c) { return a + c.ms; }, 0) / cs.length / 1000 : 0;
      var fastest = cs.length ? Math.min.apply(null, cs.map(function (c) { return c.ms; })) / 1000 : 0;
      var edited = T.diaries.filter(function (d) { return d.edited; }).length;
      var report = [
        "【例外事案調査報告 ―― 対象: あなた】",
        "【プレイ時間: " + mm + "分" + ss + "秒】",
        "【選択回数: " + cs.length + "回 ／ 平均決断時間: " + avg.toFixed(1) + "秒 ／ 最速: " + fastest.toFixed(1) + "秒】",
        "【情動ログ: " + T.diaries.length + "件提出 ―― うち、手で書き直した夜: " + edited + "件】",
        "【ヒント使用: " + T.hints + "回】"
      ];
      await playLines(report);
      await waitTap();
      await playLines(n.lines || []);
      choiceButtons(n.choices, async function (c, ms) {
        addLineNow(c.label, "me");
        if (c.erase) {
          store.del("ng-pos");
          store.del("ng-telem");
          resetTelemetry();
        }
        await playLines(c.reply || []);
        await waitTap();
        await runNode(c.next || n.next);
      });
    },

    /* 終了カード */
    end: async function (n) {
      await playLines(n.lines || []);
      store.del("ng-pos");
      choiceButtons([{ label: n.button || "書庫に戻る" }], async function () {
        location.reload();
      });
    }
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- 公開API ---------- */
  return {
    register: function (s) { scenarios[s.id] = s; },
    scenarios: scenarios,
    savedPos: function () {
      var v = store.get("ng-pos");
      if (!v) return null;
      try { return JSON.parse(v); } catch (e) { return null; }
    },
    clearSave: function () { store.del("ng-pos"); },
    boot: function () {
      flow = $("flow"); controls = $("controls"); fx = $("fx"); hud = $("hud");
      flow.addEventListener("click", onTap);
      document.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") {
          if (document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
          if (document.activeElement && document.activeElement.tagName === "BUTTON") return;
          onTap();
        }
      });
    },
    start: function (scenId, fromNode) {
      cur = scenarios[scenId];
      resetTelemetry();
      $("library").hidden = true;
      $("game").hidden = false;
      setModeInstant(cur.mode || "kiko");
      var first = fromNode || cur.start;
      if (fromNode) addLineNow("―― 記録から再開 ――", "faint");
      runNode(first);
    }
  };
})();
