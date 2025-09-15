"use strict";

// ===== Fixed CSV URL =====
var DEFAULT_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDR8FLvzRE3xt2vRiBPy043pDMCRJbnrmm4AEj6k4SYRQ5OSMzIjhWjeUASPMWX0I5SFK3Zl1P1pPB/pub?gid=1081595336&single=true&output=csv";

// ===== State =====
var allData = [];
var settings = {
  order: "fixed",
  limit: 0,
  theme: localStorage.getItem("theme") || "dark",
  fontScale: parseFloat(localStorage.getItem("font") || "1")
};
var weakKey = "weak:default";

// ===== Helpers =====
function $(id) { return document.getElementById(id); }

function setTheme(t) {
  if (t === "light") document.body.classList.add("light");
  else document.body.classList.remove("light");
  settings.theme = t;
  localStorage.setItem("theme", t);
}

function setFont(scale) {
  var s = scale;
  if (!s || isNaN(s)) s = 1;
  s = Math.max(0.85, Math.min(1.4, s));
  document.body.style.fontSize = (16 * s) + "px";
  settings.fontScale = s;
  localStorage.setItem("font", String(s));
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = (Math.random() * (i + 1)) | 0;
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// ===== CSV =====
async function loadCSV(url) {
  var res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("CSV fetch error");
  var txt = await res.text();
  return parseCSV(txt);
}

// robust csv parser (quotes/commas/newlines)
function parseCSV(text) {
  var s = String(text || "");
  var rows = [];
  var i = 0, cell = "", cur = [], inQ = false;
  while (i < s.length) {
    var ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ",") { cur.push(cell); cell = ""; i++; continue; }
    if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    cell += ch; i++;
  }
  if (cell.length || cur.length) { cur.push(cell); rows.push(cur); }
  if (!rows.length) return [];

  var header = rows.shift();
  var out = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      var key = (header[c] || "").trim();
      var val = (row[c] || "").trim();
      obj[key] = val;
    }
    out.push(obj);
  }
  return out;
}

// ===== Weak list =====
function loadWeak() {
  try { return JSON.parse(localStorage.getItem(weakKey) || "[]"); }
  catch (e) { return []; }
}
function saveWeak(list) { localStorage.setItem(weakKey, JSON.stringify(list)); }
function sameItem(a, b) {
  return (a.id || "") === (b.id || "") &&
         (a.subject || "") === (b.subject || "") &&
         (a.question || "") === (b.question || "");
}

// ===== UI =====
function renderSubjects() {
  var subs = [];
  for (var i = 0; i < allData.length; i++) {
    var s = allData[i].subject || allData[i]["科目"] || "";
    if (s && subs.indexOf(s) < 0) subs.push(s);
  }
  subs.sort(function(a,b){ return a.localeCompare(b, "ja"); });

  var box = $("subjects");
  box.innerHTML = "";
  if (!subs.length) {
    var p = document.createElement("div");
    p.className = "muted";
    p.textContent = "CSVの読み込みに失敗している可能性があります。";
    box.appendChild(p);
    return;
  }
  subs.forEach(function(sub){
    var b = document.createElement("button");
    b.className = "pill";
    b.textContent = sub;
    b.onclick = function(){ startQuiz(sub); };
    box.appendChild(b);
  });
}

function startQuiz(sub) {
  $("home").classList.add("hidden");
  $("weak").classList.add("hidden");
  $("quiz").classList.remove("hidden");

  var list = allData.filter(function(r){
    return (r.subject || r["科目"] || "") === sub;
  }).map(function(r){
    return {
      id: r.id || "",
      subject: r.subject || r["科目"] || "",
      unit: r.unit || r["単元"] || "",
      question: r.question || r["問題"] || "",
      a: r.choice_a || r.A || r.choiceA || r["A"] || "",
      b: r.choice_b || r.B || r.choiceB || r["B"] || "",
      c: r.choice_c || r.C || r.choiceC || r["C"] || "",
      d: r.choice_d || r.D || r.choiceD || r["D"] || "",
      answer: String(r.answer || r["正解"] || "").trim().toUpperCase(),
      explanation: r.explanation || r["解説"] || ""
    };
  });

  if (settings.order === "random") list = shuffle(list);
  var lim = parseInt($("limit").value || "0", 10);
  if (!lim) lim = settings.limit || 0;
  if (lim > 0) list = list.slice(0, lim);

  renderQuizList(list, sub);
}

function renderQuizList(list, sub) {
  var cont = $("quiz");
  cont.innerHTML = "";

  var head = document.createElement("div");
  head.className = "row";
  var title = document.createElement("b");
  title.textContent = sub + " ／ 全" + list.length + "問";
  head.appendChild(title);
  var back = document.createElement("button");
  back.textContent = "TOPへ";
  back.onclick = function(){
    $("quiz").classList.add("hidden");
    $("home").classList.remove("hidden");
  };
  head.appendChild(back);
  cont.appendChild(head);

  list.forEach(function(q, idx){
    var card = document.createElement("div");
    card.className = "card";

    var t = document.createElement("div");
    t.innerHTML = "<b>Q" + (idx+1) + ". " + q.question + "</b>";
    card.appendChild(t);

    if (q.unit) {
      var u = document.createElement("div");
      u.className = "muted";
      u.textContent = q.unit;
      card.appendChild(u);
    }

    var chWrap = document.createElement("div");
    chWrap.className = "choices";
    [["A","a"],["B","b"],["C","c"],["D","d"]].forEach(function(pair){
      var mark = pair[0], key = pair[1];
      var txt = q[key];
      if (!txt) return;
      var btn = document.createElement("button");
      btn.textContent = mark + "： " + txt;
      btn.onclick = function(){
        var correct = (mark === q.answer) || (txt === q.answer);
        btn.classList.add(correct ? "correct" : "wrong");
        if (!correct) {
          var wk = loadWeak();
          if (!wk.some(function(x){ return sameItem(x, q); })) {
            wk.push(q); saveWeak(wk);
          }
        }
        exp.textContent = "解説: " + q.explanation;
      };
      chWrap.appendChild(btn);
    });
    card.appendChild(chWrap);

    var exp = document.createElement("div");
    exp.className = "explain muted";
    card.appendChild(exp);

    cont.appendChild(card);
  });
}

function renderWeak() {
  var arr = loadWeak();
  var subs = [];
  for (var i = 0; i < arr.length; i++) {
    var s = arr[i].subject;
    if (s && subs.indexOf(s) < 0) subs.push(s);
  }
  subs.sort(function(a,b){ return a.localeCompare(b, "ja"); });

  var sel = $("weakFilter");
  sel.innerHTML = "";
  var optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "（すべての科目）";
  sel.appendChild(optAll);
  subs.forEach(function(s){
    var o = document.createElement("option");
    o.value = s; o.textContent = s;
    sel.appendChild(o);
  });
  buildWeakList();
}

function buildWeakList() {
  var wrap = $("weakList");
  wrap.innerHTML = "";
  var cur = $("weakFilter").value;
  var arr = loadWeak();
  if (cur) arr = arr.filter(function(x){ return x.subject === cur; });

  arr.forEach(function(q, idx){
    var d = document.createElement("div");
    d.className = "card";
    var s = document.createElement("div");
    s.innerHTML = "<b>[" + q.subject + "] " + q.question + "</b>";
    d.appendChild(s);
    var a = document.createElement("div");
    a.textContent = "答え: " + q.answer;
    d.appendChild(a);
    if (q.explanation) {
      var e = document.createElement("div");
      e.textContent = "解説: " + q.explanation;
      d.appendChild(e);
    }
    var rm = document.createElement("button");
    rm.textContent = "削除";
    rm.onclick = function(){
      var all = loadWeak();
      all.splice(idx, 1);
      saveWeak(all);
      buildWeakList();
    };
    d.appendChild(rm);
    wrap.appendChild(d);
  });
}

// ===== Events =====
window.addEventListener("DOMContentLoaded", function(){
  setTheme(settings.theme);
  setFont(settings.fontScale || 1);

  $("theme").onclick = function(){
    setTheme(document.body.classList.contains("light") ? "dark" : "light");
  };
  $("fontSm").onclick = function(){ setFont((settings.fontScale || 1) - 0.1); };
  $("fontLg").onclick = function(){ setFont((settings.fontScale || 1) + 0.1); };
  $("btnWeak").onclick = function(){
    $("home").classList.add("hidden");
    $("quiz").classList.add("hidden");
    $("weak").classList.remove("hidden");
    renderWeak();
  };
  $("weakBack").onclick = function(){
    $("weak").classList.add("hidden");
    $("home").classList.remove("hidden");
  };
  $("weakClear").onclick = function(){
    if (confirm("苦手一覧を全削除しますか？")) { saveWeak([]); buildWeakList(); }
  };
  $("weakFilter").onchange = buildWeakList;

  // Auto load CSV
  loadCSV(DEFAULT_CSV)
    .then(function(rows){
      allData = rows;
      renderSubjects();
    })
    .catch(function(err){
      console.error(err);
      alert("データ読み込みに失敗しました。公開CSVのURLを確認してください。");
    });
});
