(() => {
  "use strict";

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  // 低解析度邏輯畫布,由 CSS 以整數倍放大 => 真正的像素風,不會有反鋸齒糊邊
  const W = 160, H = 112;
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const shrineWrap = document.getElementById("shrineWrap");
  const coinLayer = document.getElementById("coinLayer");
  const sparkleLayer = document.getElementById("sparkleLayer");
  const throwBtn = document.getElementById("throwBtn");
  const hint = document.getElementById("hint");
  const counterEl = document.getElementById("counter");
  const fortunePanel = document.getElementById("fortunePanel");
  const fortuneTierEl = document.getElementById("fortuneTier");
  const fortuneNameEl = document.getElementById("fortuneName");
  const fortuneVerseEl = document.getElementById("fortuneVerse");
  const fortuneLuckEl = document.getElementById("fortuneLuck");
  const fortuneElemEl = document.getElementById("fortuneElem");
  const fortuneGoodEl = document.getElementById("fortuneGood");
  const fortuneBadEl = document.getElementById("fortuneBad");
  const againBtn = document.getElementById("againBtn");

  /* ---------- 像素繪圖原語:座標一律取整,保證每個像素邊緣銳利 ---------- */

  function rect(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function span(y, x0, x1, c) {
    const a = Math.round(x0), b = Math.round(x1);
    if (b <= a) return;
    ctx.fillStyle = c;
    ctx.fillRect(a, Math.round(y), b - a, 1);
  }

  // 逐列計算半寬後整列填滿 => 圓弧邊緣是階梯狀的像素,而不是模糊漸層
  function ellipse(cx, cy, rx, ry, c) {
    ctx.fillStyle = c;
    const top = Math.ceil(cy - ry), bot = Math.floor(cy + ry);
    for (let y = top; y <= bot; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const v = 1 - dy * dy;
      if (v <= 0) continue;
      const half = rx * Math.sqrt(v);
      const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }

  function ring(cx, cy, rx, ry, t, c) {
    ctx.fillStyle = c;
    const top = Math.ceil(cy - ry), bot = Math.floor(cy + ry);
    const rxi = Math.max(0, rx - t), ryi = Math.max(0.001, ry - t);
    for (let y = top; y <= bot; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const v = 1 - dy * dy;
      if (v <= 0) continue;
      const half = rx * Math.sqrt(v);
      const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
      const dyi = (y + 0.5 - cy) / ryi;
      const vi = 1 - dyi * dyi;
      if (vi <= 0) { ctx.fillRect(x0, y, x1 - x0, 1); continue; }
      const hi = rxi * Math.sqrt(vi);
      const i0 = Math.round(cx - hi), i1 = Math.round(cx + hi);
      ctx.fillRect(x0, y, i0 - x0, 1);
      ctx.fillRect(i1, y, x1 - i1, 1);
    }
  }

  /* ---------- 色盤 ---------- */

  const C = {
    // 白鴨 + 黑描邊。描邊是這個風格的關鍵,少了就會糊成一團色塊;
    // 白羽在夜景裡的對比也遠比褐色好,剪影一眼就跳出來。
    ink: "#141017",
    white: "#f6f6fa", whiteLit: "#ffffff",
    shade: "#c3c3d8", shadeDeep: "#9a9ab6",
    bill: "#f5a03c", billLight: "#ffc067", billDark: "#d97b28",
    hat: "#2b2338", hatLight: "#4c4364",
    robe: "#f7f2e6", robeShade: "#cec4ae",
    halo: "#ffe36b", haloBright: "#fff6c4",
    torii: "#cf4436", toriiDark: "#93261f", toriiLight: "#e8604f", toriiCap: "#241016",
    gold: "#e8c24f", goldDark: "#a8811f",
    wood: "#7a5533", woodDark: "#4e3520", woodLight: "#966b42", woodPlank: "#5f4126",
    stone: "#6a6480", stoneDark: "#494360", stoneLight: "#837da0",
    gohei: "#8a6034", goheiDark: "#5d3f21"
  };

  const HORIZON = 80;
  const BOX = { x: 48, y: 86, w: 64, h: 21 };
  const DUCK_CX = 80;

  /* ---------- 場景元件 ---------- */

  const STARS = [];
  [[8,8],[20,20],[33,6],[52,14],[64,4],[96,10],[118,6],[128,26],[14,34],[26,46],
   [6,52],[40,30],[72,22],[104,32],[150,40],[156,20],[136,46],[120,52],[88,6],[46,52],
   [152,58],[12,64],[30,62],[4,24],[110,18]].forEach((p, i) => {
    STARS.push({ x: p[0], y: p[1], phase: i * 0.83, big: i % 4 === 0 });
  });

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, "#0d0f2b");
    g.addColorStop(0.55, "#1b1c46");
    g.addColorStop(1, "#3d2a5e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON);
  }

  function drawStars(now) {
    STARS.forEach(s => {
      const a = 0.45 + 0.55 * Math.abs(Math.sin(now / 900 + s.phase));
      ctx.fillStyle = `rgba(242,236,212,${a.toFixed(2)})`;
      ctx.fillRect(s.x, s.y, s.big ? 2 : 1, s.big ? 2 : 1);
    });
  }

  function drawMoon() {
    const mx = 144, my = 20;
    const g = ctx.createRadialGradient(mx, my, 2, mx, my, 20);
    g.addColorStop(0, "rgba(255,249,224,0.30)");
    g.addColorStop(1, "rgba(255,249,224,0)");
    ctx.fillStyle = g;
    ctx.fillRect(mx - 20, my - 20, 40, 40);

    ellipse(mx, my, 7, 7, "#fdf6d8");
    ellipse(mx - 2, my - 2, 1.6, 1.6, "#e2d5ac");
    ellipse(mx + 3, my + 2, 1.2, 1.2, "#e2d5ac");
    ellipse(mx + 1, my - 4, 1, 1, "#e2d5ac");
  }

  function drawGround() {
    const g = ctx.createLinearGradient(0, HORIZON, 0, H);
    g.addColorStop(0, "#33254e");
    g.addColorStop(1, "#180f2b");
    ctx.fillStyle = g;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    // 參道:由地平線向前擴張的石板路
    for (let y = HORIZON; y < H; y++) {
      const t = (y - HORIZON) / (H - HORIZON);
      const half = 12 + t * 26;
      span(y, DUCK_CX - half, DUCK_CX + half, "#463561");
    }
    // 石板橫縫
    for (let y = HORIZON + 6; y < H; y += 7) {
      const t = (y - HORIZON) / (H - HORIZON);
      const half = 12 + t * 26;
      span(y, DUCK_CX - half, DUCK_CX + half, "#3b2c53");
    }
    rect(0, HORIZON, W, 1, "#4a3568");
  }

  // 鳥居拉寬到 x34/x120,讓側身的鴨子連喙帶尾都有位置站
  function drawTorii() {
    // 笠木(最上層橫梁)
    rect(22, 1, 116, 3, C.toriiCap);
    rect(26, 4, 108, 4, C.torii);
    rect(26, 4, 108, 1, C.toriiLight);
    // 島木
    rect(28, 8, 104, 2, C.toriiDark);
    // 額束(匾額)
    rect(74, 10, 12, 6, C.goldDark);
    rect(75, 11, 10, 4, C.gold);
    // 貫(第二層橫梁)
    rect(32, 16, 96, 3, C.torii);
    rect(32, 18, 96, 1, C.toriiDark);
    // 柱
    [34, 120].forEach(x => {
      rect(x, 8, 6, 76, C.torii);
      rect(x, 8, 1, 76, C.toriiLight);
      rect(x + 5, 8, 1, 76, C.toriiDark);
      rect(x - 1, 80, 8, 4, C.toriiCap);
    });
  }

  // 注連繩:掛在貫下方,中央自然下垂,附四道紙垂
  function drawShimenawa() {
    const x0 = 48, x1 = 112, yTop = 20;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const sag = Math.round(Math.sin(Math.PI * t) * 2);
      const h = 4 + Math.round(Math.sin(Math.PI * t));
      rect(x, yTop + sag, 1, h, "#b09a6a");
      rect(x, yTop + sag, 1, 1, "#d4c091");
      rect(x, yTop + sag + h - 1, 1, 1, "#7a6740");
    }
    for (let x = x0 + 3; x < x1; x += 5) {          // 繩紋
      const t = (x - x0) / (x1 - x0);
      rect(x, yTop + Math.round(Math.sin(Math.PI * t) * 2) + 1, 1, 3, "#8d7a4e");
    }
    [57, 73, 89, 103].forEach(sx => {                // 紙垂
      const t = (sx - x0) / (x1 - x0);
      const y = yTop + Math.round(Math.sin(Math.PI * t) * 2) + 5;
      [[0, 0], [2, 3]].forEach(([ox, oy]) => {
        rect(sx + ox - 1, y + oy - 1, 6, 5, C.ink);
        rect(sx + ox, y + oy, 4, 3, "#f7f2e6");
      });
    });
  }

  // 御幣(祓禊用的幣串),鴨鴨神的神主法器。
  // 紙垂直接貼著幣串左右兩側垂下,不用橫桿 — 橫桿在這個尺寸下會讀成十字架。
  // 御幣改成立在鴨子左側的神具(側身姿勢下鴨子沒有手可以握)
  function drawGohei() {
    const gx = 112;
    rect(gx - 1, 39, 5, 43, C.ink);
    rect(gx, 40, 3, 42, C.gohei);
    rect(gx, 40, 1, 42, "#a87a45");
    rect(gx - 1, 38, 5, 3, C.ink);
    rect(gx, 39, 3, 2, C.gold);

    // 紙垂:單道大鋸齒繞著幣串左右交錯,階距夠大才讀得出是摺紙
    const steps = [[107, 42], [111, 46], [107, 50]];
    steps.forEach(([x, y]) => rect(x - 1, y - 1, 8, 6, C.ink));
    steps.forEach(([x, y]) => {
      rect(x, y, 6, 4, C.robe);
      rect(x, y, 1, 4, C.robeShade);
      rect(x, y, 6, 1, "#ffffff");
    });
    // 台座
    rect(106, 80, 15, 4, C.ink);
    rect(107, 81, 13, 2, C.stoneDark);
  }

  /* ---------- 鴨鴨神本體 ----------
     逐格手繪的點陣圖,不是用橢圓疊出來的。低解析度下演算法產生的橢圓
     邊緣會有不規則鋸齒,描邊粗細也隨曲率忽粗忽細 —— 那是先前幾版
     看起來「不像像素畫」的根本原因。手繪才控制得住每一個像素。
     K=描邊 W=白羽 w=陰影 O=橘 o=暗橘 H=烏帽子 h=帽面反光 #=眼神光 */
  const DUCK_PAL = {
    K: "#17131c", W: "#f7f7fb", w: "#ccccdf",
    O: "#f6a23e", o: "#d4791f", g: "#a8a8c4",
    H: "#2a2338", h: "#4a4260", "#": "#ffffff"
  };

  const DUCK = [
    "...............KKKKKK.............",
    "..............KHHHHHHK............",
    "..............KhHHHHHK............",
    ".............KhHHHHHHK............",
    ".............KhHHHHHHK............",
    "............KhHHHHHHHK............",
    "............KhHHHHHHHK............",
    "...........KhHHHHHHHHHK...........",
    "..........KhHHHHHHHHHHHK..........",
    "..........KKKKKKKKKKKKKK..........",
    "...........KWWWWWWWWWWK...........",
    ".........KWWWWWWWWWWWWWWK.........",
    "........KWWWWWWWWWWWWWWWWK........",
    ".......KWWWKKKWWWWWWWWWWWWK.......",
    ".......KWWW#KKWWWWWWWWWWWWK.......",
    ".......KWWWKKKWWWWWWWWWWWWK.......",
    ".......KWWWKKKWWWWWWWWWWWWK.......",
    "...KKKKKKWWWWWWWWWWWWWWWWWK.......",
    "..KOOOOOOOWWWWWWWWWWWWWWWWK.......",
    ".KOOOOOOOOWWWWWWWWWWWWWWWWK.......",
    ".KooooooooWWWWWWWWWWWWWWWWK.......",
    "..KKKKKKKKWWWWWWWWWWWWWWWK........",
    "........KWWWWWWWWWWWWwwwwK........",
    ".........KWWWWWWWWWWwwwwK.........",
    "..........KWWWWWWWWwwwwK..........",
    "...........KWWWWWWWWwwK...........",
    "............KWWWWWWWwwK...........",
    "..........KWWWWWWWWWWWWwwK........",
    ".......KWWWWWWWWWWWWWWWWWwwwwK....",
    ".....KWWWWWWWWWWWWWWWWWWWwwwwwwK..",
    "....KWWWWWWWWWWWWWWWWWWWwwwwwwwwK.",
    "....KWWWWWWWWWWWWWWWWWWwwwwwwwwwwK",
    "....KWWWWWWWWWWWWWWWWWwwwwwwwwwwK.",
    "....KWWWWWWWWWWWWWWWgggggggggwwwK.",
    ".....KWWWWWWWWWWWWWggwwwwwwwwwwK..",
    "......KWWWWWWWWWWWwwwwwwwwwwwwK...",
    "........KWWWWWWWWwwwwwwwwwwwK.....",
    "...........KwwwwwwwwwwwwwK........",
    "...........KKKKKKKKKKKKKKK........",
    ".............KOOK...KOOK..........",
    ".............KOOK...KOOK..........",
    ".............KOOK...KOOK..........",
    "..........KOOOOOK.KOOOOOK.........",
    "..........KKKKKKK.KKKKKKK.........",
  ];

  const DUCK_X = 62, DUCK_Y = 42;

  // 表情:眼睛在 sprite 內固定佔 cols 11-13 / rows 13-16,可整塊換掉
  const EYES = {
    normal: ["KKK", "#KK", "KKK", "KKK"],
    happy:  ["...", ".K.", "K.K", "..."],   // 笑成一條弧線
    dead:   ["...", "KKK", "...", "..."]    // 死魚眼
  };
  const EYE_X = 11, EYE_Y = 13;
  let duckMood = "normal";

  function drawSprite(rows, pal, ox, oy) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === ".") { x++; continue; }
        let run = 1;
        while (x + run < row.length && row[x + run] === ch) run++;
        ctx.fillStyle = pal[ch];
        ctx.fillRect(ox + x, oy + y, run, 1);
        x += run;
      }
    }
  }

  function drawDuck(now) {
    const dy = Math.round(Math.sin(now / 900) * 1.2);          // 呼吸浮動
    const hy = dy + Math.round(Math.sin(now / 1300) * 0.6);    // 後光稍微錯開

    // 後光:對齊烏帽子正上方
    const gl = ctx.createRadialGradient(79, 36 + hy, 2, 79, 36 + hy, 14);
    gl.addColorStop(0, "rgba(255,227,107,0.24)");
    gl.addColorStop(1, "rgba(255,227,107,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(65, 22 + hy, 28, 28);
    ring(79, 36 + hy, 8, 2.8, 1, C.halo);
    ring(79, 36 + hy, 6.5, 1.8, 1, C.haloBright);

    drawSprite(DUCK, DUCK_PAL, DUCK_X, DUCK_Y + dy);

    // 換表情:先用白羽蓋掉底圖的眼睛,再疊上當前表情
    if (duckMood !== "normal") {
      rect(DUCK_X + EYE_X, DUCK_Y + EYE_Y + dy, 3, 4, DUCK_PAL.W);
      drawSprite(EYES[duckMood], DUCK_PAL, DUCK_X + EYE_X, DUCK_Y + EYE_Y + dy);
    }
  }

  function drawLantern(cx, now, phase) {
    const top = 60;
    const flick = 0.72 + 0.28 * Math.abs(Math.sin(now / 190 + phase));

    const g = ctx.createRadialGradient(cx, top + 8, 0, cx, top + 8, 14);
    g.addColorStop(0, `rgba(255,180,90,${(0.40 * flick).toFixed(2)})`);
    g.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 14, top - 6, 28, 28);

    rect(cx - 7, top, 14, 3, C.stone);
    rect(cx - 7, top, 14, 1, C.stoneLight);
    rect(cx - 5, top + 3, 10, 2, C.stoneDark);
    rect(cx - 4, top + 5, 8, 7, C.stone);
    ctx.fillStyle = `rgba(255,183,77,${flick.toFixed(2)})`;
    ctx.fillRect(cx - 2, top + 6, 4, 5);
    rect(cx - 5, top + 12, 10, 2, C.stoneDark);
    rect(cx - 2, top + 14, 4, 8, C.stone);
    rect(cx - 2, top + 14, 1, 8, C.stoneLight);
    rect(cx - 6, top + 22, 12, 3, C.stoneDark);
  }

  function drawOfferingBox() {
    const { x, y, w } = BOX;
    const topH = 8, inset = 7, slats = 13;
    const faceY = y + topH, faceH = 13;

    // --- 上方格柵(投錢口):向後收窄的透視梯形。
    //     這是賽錢箱最好認的特徵,只開一條黑縫是認不出來的 ---
    for (let i = 0; i < topH; i++) {
      const t = i / (topH - 1);
      const ins = Math.round(inset * (1 - t));
      const l = x + ins, r = x + w - ins;
      span(y + i, l, r, "#241608");                       // 格柵縫隙的暗處
      for (let k = 0; k <= slats; k++) {                  // 木條,由後向前散開
        rect(Math.round(l + (r - l) * k / slats), y + i, 1, 1,
             i === 0 ? C.woodPlank : C.woodLight);
      }
      rect(l - 1, y + i, 1, 1, C.woodDark);
      rect(r, y + i, 1, 1, C.woodDark);
    }
    rect(x + inset - 1, y - 1, w - 2 * inset + 2, 1, C.woodDark);

    // --- 正面箱體 ---
    rect(x - 1, faceY - 1, w + 2, faceH + 2, "#33220f");
    rect(x, faceY, w, faceH, C.wood);
    rect(x, faceY, w, 1, C.woodLight);
    for (let i = 1; i < 5; i++) {
      rect(x + Math.round(i * w / 5), faceY + 1, 1, faceH - 1, C.woodPlank);
    }

    // --- 四角金具 ---
    [[x, faceY], [x + w - 6, faceY],
     [x, faceY + faceH - 5], [x + w - 6, faceY + faceH - 5]].forEach(([bx, by]) => {
      rect(bx, by, 6, 5, "#2e3a30");
      rect(bx, by, 6, 1, "#4e5c4a");
      rect(bx + 1, by + 2, 1, 1, "#8f8f74");
      rect(bx + 4, by + 2, 1, 1, "#8f8f74");
    });

    // 正面不放字:9x9 放不下「賽錢」的 17 劃跟 16 劃,只會變成兩團噪點。
    // 留素木配四角金具,在像素尺度下最乾淨。

    // --- 台座 ---
    rect(x - 5, faceY + faceH + 1, w + 10, 4, "#2a1c10");
    rect(x - 4, faceY + faceH + 2, w + 8, 2, "#4e3520");
  }

  function renderScene(now) {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawStars(now);
    drawMoon();
    drawGround();
    drawTorii();
    drawShimenawa();
    drawGohei();
    drawDuck(now);
    drawLantern(16, now, 0);
    drawLantern(144, now, 2.1);
    drawOfferingBox();
  }

  (function loop(now) {
    renderScene(now || 0);
    requestAnimationFrame(loop);
  })(0);

  /* ---------- 音效(即時合成,不需外部音檔) ---------- */

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, start, duration, type, peakGain) {
    const ac = getAudio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    gain.gain.setValueAtTime(0, ac.currentTime + start);
    gain.gain.linearRampToValueAtTime(peakGain, ac.currentTime + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + duration + 0.02);
  }

  function playClink() {
    tone(1600, 0, 0.12, "triangle", 0.18);
    tone(2200, 0.05, 0.15, "triangle", 0.12);
  }

  function playBell() {
    tone(880, 0, 0.9, "sine", 0.15);
    tone(1320, 0.02, 0.7, "sine", 0.08);
  }

  /* ---------- 神籤 ---------- */

  // 每個籤等有多張籤文,抽中等級後再隨機挑一張,重複參拜才不會看到同樣的內容
  const FORTUNES = [
    {
      tier: "大吉", weight: 3, luck: "★★★★★ 歐氣衝破天井",
      slips: [
        {
          name: "天選騎空士",
          verse: "彩虹光直接閃瞎你的眼,\n單抽就把 UP 角帶回家。\n連緋緋色金都想主動來找你,\n今天不抽對不起自己。",
          good: "十連、追本命 UP、開限定池", bad: "猶豫、關掉遊戲"
        },
        {
          name: "轉蛋精靈附體",
          verse: "轉蛋精靈模式一路綠燈,\n連抽連中停不下來。\n榭洛看到你都想跟你進貨,\n今天你就是團裡的傳說。",
          good: "傳說召喚、清空水晶", bad: "留手、明天再說"
        },
        {
          name: "緋緋色金雙掉",
          verse: "古戰場的箱子開到手軟,\n稀有素材像不用錢一樣掉。\n十天眾的解放條一路推到底,\n今天連小碧都替你高興。",
          good: "刷本、開箱、解放角色", bad: "離開座位"
        },
        {
          name: "木村發糖了",
          verse: "生放送剛結束,木村大手一揮發石頭。\n新角色強度超標,復刻活動也一起來。\n這種日子一年沒幾天,\n今天不抽要等哪天?",
          good: "清空水晶、追新角", bad: "睡過頭錯過活動"
        },
        {
          name: "十天眾畢業",
          verse: "素材一次湊齊,十天眾當場解放。\n最終上限也一路推到底,\n肝了半年的東西今天全部收成。\n連小碧都跳起來鼓掌。",
          good: "解放角色、上限突破", bad: "現在關遊戲"
        },
        {
          name: "虹光滿天",
          verse: "藍銀金虹,今天只看得到虹。\n十連開出三隻 SSR,\n其中兩隻還是本命。\n截圖發到團裡,讓大家羨慕一下。",
          good: "十連、截圖炫耀", bad: "謙虛、低調"
        },
        {
          name: "小福報喜",
          verse: "生放送上小福笑得特別開心,\n新活動的獎勵表一路往上加。\n木村在旁邊猛點頭,\n今天的好消息是真的。",
          good: "上線領獎勵、追活動", bad: "錯過領取期限"
        },
        {
          name: "神石畢業",
          verse: "終末武器打磨完成,\n神石隊成型的那一刻,\n傷害數字整個換了一個級距。\n肝了那麼久,今天全部值回票價。",
          good: "換編成、挑戰高難本", bad: "謙虛地說還好"
        }
      ]
    },
    {
      tier: "中吉", weight: 10, luck: "★★★★☆ 手氣正順",
      slips: [
        {
          name: "金光連發",
          verse: "金光閃了好幾次,\nSSR 出現的頻率高得不像話。\n雖然還沒摸到天井,\n但你已經比隔壁團長幸運多了。",
          good: "十連、刷素材、開箱", bad: "分心、手滑點錯"
        },
        {
          name: "歐氣蓄積中",
          verse: "虹光雖然還沒出現,\n但金色的邊框一直在跳。\n再推一把應該就有結果,\n今天的手感值得相信。",
          good: "再抽一輪、追加十連", bad: "見好收得太早"
        },
        {
          name: "本命在望",
          verse: "你要的角色就在名單最上面,\n機率站在你這邊。\n石頭還夠,天井也不遠,\n今天適合放膽一搏。",
          good: "開限定池、拚 UP", bad: "臨時改抽別的池"
        },
        {
          name: "自選票到手",
          verse: "自選票終於發下來了,\n名單上剛好有你缺的那張。\n不用抽,直接拿,\n這種踏實感久違了。",
          good: "兌換自選票、補戰力", bad: "選錯又後悔"
        },
        {
          name: "古戰場前段班",
          verse: "古戰場打得順手,\n貢獻度默默爬到團內前段。\n肝是肝了點,但至少有回報,\n團長今天看你特別順眼。",
          good: "刷古戰場、衝貢獻", bad: "半夜偷懶"
        },
        {
          name: "半額加持",
          verse: "半額期間,AP 怎麼喝都夠。\n素材本刷得飛快,\n掉落率今天也格外賞臉。\n趁現在把該補的都補一補。",
          good: "半額刷本、囤素材", bad: "等到期才想起來"
        },
        {
          name: "小福的活動介紹",
          verse: "小福把新活動講得天花亂墜,\n你半信半疑地點進去,\n結果比想像中好玩。\n今天適合相信官方一次。",
          good: "跑新活動、拿獎勵", bad: "等別人打完攻略再說"
        },
        {
          name: "四象順風",
          verse: "四象降臨的素材收得很順,\n想換的東西都換到了。\n沒有大爆發,但每一步都踏實,\n這種節奏最舒服。",
          good: "換四象素材、清商店", bad: "囤到過期"
        }
      ]
    },
    {
      tier: "小吉", weight: 17, luck: "★★★☆☆ 穩穩過關",
      slips: [
        {
          name: "安穩出貨",
          verse: "該出的都會出,只是慢了點。\n不會爆死,但也別期待奇蹟。\n今天適合安穩地養角色,\n順便把每日任務做一做。",
          good: "每日免費單抽、日常任務", bad: "大額課金"
        },
        {
          name: "半額之恩",
          verse: "半額期間刷本特別順,\n素材默默地累積起來。\n沒有驚喜也沒有驚嚇,\n騎空士的小確幸就是這個。",
          good: "半額刷本、存素材", bad: "硬闖高難本"
        },
        {
          name: "榭洛的微笑",
          verse: "商店裡剛好有你要的東西,\n碎片湊齊換到一張還不錯的卡。\n不是本命,但用起來很順手,\n今天的收穫算是及格有餘。",
          good: "兌換商店、清碎片", bad: "眼高手低"
        },
        {
          name: "木村的承諾",
          verse: "木村在生放送上說「今後會順次改善」,\n你選擇相信他。\n雖然不知道「順次」是多久,\n但今天的心情意外地平靜。",
          good: "相信官方、存石等改版", bad: "追問到底什麼時候"
        },
        {
          name: "Full Auto 過關",
          verse: "掛著自動戰鬥去洗澡,\n回來發現已經打完了。\n沒有翻車,也沒有驚喜,\n這就是成熟騎空士的日常。",
          good: "Full Auto、一心多用", bad: "高難本也想掛機"
        },
        {
          name: "復刻補完",
          verse: "當年錯過的活動今天復刻了,\n沒拿到的東西總算補齊。\n雖然是舊內容,\n但補完的感覺還是很好。",
          good: "補活動、清庫存", bad: "嫌棄舊內容"
        },
        {
          name: "木村與小福的雙簧",
          verse: "生放送上木村說「這個之後會調整」,\n小福在旁邊補一句「敬請期待」。\n你已經知道這代表什麼,\n但還是笑了出來。",
          good: "平常心、繼續日常", bad: "當真開始倒數"
        },
        {
          name: "天司武器成型",
          verse: "天司武器的素材總算湊齊,\n編成裡多了一格穩定輸出。\n進步不大,\n但確實往前走了一步。",
          good: "補天司、調編成", bad: "好高騖遠"
        }
      ]
    },
    {
      tier: "吉", weight: 25, luck: "★★★☆☆ 普通的一天",
      slips: [
        {
          name: "騎空士的日常",
          verse: "平常心就好,今天沒什麼特別的。\n金月藍月默默地累積,\n素材慢慢攢,總有畢業的一天。\n騎空士的日常就是這樣。",
          good: "存石、刷古戰場、肝素材", bad: "梭哈全部身家"
        },
        {
          name: "自動戰鬥中",
          verse: "掛著自動戰鬥就好,\n不用太專心也能過關。\n今天適合放空,\n讓隊伍自己去打。",
          good: "Full Auto、掛機刷本", bad: "手動硬撐高難本"
        },
        {
          name: "存石的美德",
          verse: "今天不抽,明天更有力。\n水晶一顆一顆存起來,\n等下個池子開的時候,\n你會感謝現在忍住的自己。",
          good: "存石、看攻略、排隊伍", bad: "一時衝動開池"
        },
        {
          name: "沙盒巡禮",
          verse: "沙盒裡繞了一圈,\n該收的收一收,該打的打一打。\n進度條動得不快,\n但總是往前走。",
          good: "跑沙盒、清周常", bad: "想一天跑完"
        },
        {
          name: "素材本輪班",
          verse: "今天開的本剛好不是你要的,\n只好先去刷別的。\n騎空士的行程表就是這樣排的,\n急也沒用。",
          good: "照表操課、囤別的素材", bad: "抱怨開放時間"
        },
        {
          name: "團活動打卡",
          verse: "團裡的活動照常跑,\n貢獻度不高不低。\n團長沒念你,你也沒偷懶,\n平穩的一天。",
          good: "團活動、日常打卡", bad: "退團衝動"
        },
        {
          name: "生放送日常",
          verse: "木村跟小福又坐在那張沙發上,\n講了一小時,重點大概三分鐘。\n你邊聽邊掛自動戰鬥,\n這樣剛剛好。",
          good: "掛機看生放送、清日常", bad: "全程專心期待"
        },
        {
          name: "素材本輪值",
          verse: "素材本開了又關,關了又開,\n你照著時間表進進出出。\n沒什麼刺激,\n但進度確實在動。",
          good: "照表刷本、囤素材", bad: "熬夜等開本"
        }
      ]
    },
    {
      tier: "半吉", weight: 20, luck: "★★☆☆☆ 喜憂參半",
      slips: [
        {
          name: "歪了",
          verse: "有出貨,但歪了。\n你想要的沒來,\n別人的本命倒是來了三張。\n先拿去換金月吧,至少不算白花。",
          good: "存石觀望、等下個池", bad: "不甘心再加抽"
        },
        {
          name: "重複的重複",
          verse: "同一張 SSR 出現了第四次,\n上限解放是解放了,\n但你要的那張還在名單上看著你。\n心情複雜,但也不算虧。",
          good: "上限解放、轉換素材", bad: "繼續追同一個池"
        },
        {
          name: "差一步",
          verse: "天井條看得到終點,\n石頭卻剛好不夠。\n今天就到這裡,\n剩下的留給明天的自己。",
          good: "清任務補石、等回復", bad: "課金補最後幾抽"
        },
        {
          name: "木村又跳票",
          verse: "說好這次更新要上的東西,\n在生放送最後一頁變成「敬請期待」。\n你已經習慣了,\n但還是嘆了一口氣。",
          good: "降低期待、去打古戰場", bad: "在留言區開罵"
        },
        {
          name: "紫月換不到",
          verse: "紫月攢了半天,\n想換的那把武器剛好不在名單上。\n只好先換點別的,\n安慰一下自己。",
          good: "換素材、先存著", bad: "衝動換掉"
        },
        {
          name: "不是你的主場",
          verse: "你練的屬性剛好不是這次的優勢屬性,\n打起來卡卡的。\n練是沒白練,只是今天輪不到它,\n換隊伍吧。",
          good: "換屬性隊、練副隊", bad: "硬用本命隊撞牆"
        },
        {
          name: "會列入參考",
          verse: "你在生放送留言區問了三次,\n小福只回一句「會列入參考」。\n列入參考,列入參考,\n這四個字你今年聽了很多次。",
          good: "降低期待、繼續玩", bad: "一直刷同一則留言"
        },
        {
          name: "復刻卻沒空",
          verse: "想補的活動終於復刻了,\n但你這週剛好沒時間。\n看得到吃不到,\n只能希望還有下次。",
          good: "優先清最重要的", bad: "硬要全部拿完"
        }
      ]
    },
    {
      tier: "末吉", weight: 15, luck: "★★☆☆☆ 勉強及格",
      slips: [
        {
          name: "勉強及格",
          verse: "十連開出一片藍,\n偶爾有個金光,結果還是 SR。\n天井還很遠,錢包已經在痛,\n先求平安別爆死。",
          good: "小額娛樂、放寬心", bad: "熬夜肝本"
        },
        {
          name: "肝到天亮",
          verse: "古戰場的貢獻度還差一截,\nAP 喝完了,精神也快沒了。\n今天適合認清現實,\n先睡一下再說。",
          good: "睡覺、明天補進度", bad: "硬撐、爆肝"
        },
        {
          name: "素材永遠差三個",
          verse: "差三個碎片,永遠差三個碎片。\n掉落率跟你有仇,\n刷了二十趟還是那個數字。\n今天的耐心會被考驗。",
          good: "換個本刷、放鬆一下", bad: "死磕同一個素材"
        },
        {
          name: "金剛晶遙遙無期",
          verse: "金剛晶的取得條件你又看了一遍,\n每一條都很遠。\n今天先攢一點是一點,\n別去算還要幾個月。",
          good: "慢慢攢、看長線", bad: "算完期限自我打擊"
        },
        {
          name: "六龍難產",
          verse: "六龍打了幾把都差一點,\n隊伍好像還缺些什麼。\n今天先去補裝備,\n別硬撞。",
          good: "補裝備、看攻略", bad: "無限重試"
        },
        {
          name: "AP 見底",
          verse: "AP 喝完了,半葉也用完了,\n活動進度還差一截。\n今天到此為止,\n明天回滿再說。",
          good: "等回復、下線休息", bad: "課金買 AP"
        },
        {
          name: "調整永遠在路上",
          verse: "你等的那個調整,\n木村說過,小福也說過,\n然後就沒有然後了。\n今天先用現有的隊伍撐一下。",
          good: "將就現況、練副隊", bad: "等到天荒地老"
        },
        {
          name: "賢者遙遙無期",
          verse: "賢者的解放條件你算了一下,\n素材、金剛晶、時間,一樣都不夠。\n今天先存一點是一點,\n別去看總表。",
          good: "慢慢攢、看長線", bad: "算完總帳自我打擊"
        }
      ]
    },
    {
      tier: "凶", weight: 8, luck: "★☆☆☆☆ 非酋附體",
      slips: [
        {
          name: "非酋附體",
          verse: "藍色、藍色、還是藍色,\n連個金光都吝嗇給你。\n螢幕上映出你空洞的表情,\n今天真的不是抽卡的日子。",
          good: "存石、等天井、去睡覺", bad: "課金、賭一把"
        },
        {
          name: "藍月堆成山",
          verse: "藍月倒是攢了不少,\n可惜那不是你想要的東西。\n十連的動畫你已經會背了,\n結果每次都一樣。",
          good: "關掉遊戲、出去走走", bad: "再開一個十連"
        },
        {
          name: "緋緋色金不存在",
          verse: "刷了整整一週,\n那個素材依然沒有出現。\n你開始懷疑它是不是真的存在,\n今天的運氣站在對面。",
          good: "改刷別的、降低期待", bad: "相信「下次就會掉」"
        },
        {
          name: "木村你出來",
          verse: "你已經對著螢幕喊了三次木村,\n他當然聽不到。\n問題不在他,也不在你,\n只是今天的機率不站在這邊。",
          good: "冷靜、關掉遊戲", bad: "在生放送留言區爆氣"
        },
        {
          name: "古戰場被輾",
          verse: "對面團的火力完全不是同一個級別,\n你打得很努力,結果還是被輾過去。\n今天不是實力問題,\n是配對問題。",
          good: "保存實力、明天再戰", bad: "硬拚到最後一刻"
        },
        {
          name: "十連全銀",
          verse: "十連開完,連一個金光都沒有。\n你重看了一次動畫,\n確認自己沒看漏。\n沒有,真的沒有。",
          good: "停手、存石", bad: "再開一個"
        },
        {
          name: "生放送零情報",
          verse: "等了一小時的生放送,\n木村跟小福講完,你什麼也沒記住。\n沒有新角色,沒有補償,\n只有「下次再說」。",
          good: "關掉直播、去睡", bad: "重看一次找線索"
        },
        {
          name: "連自動戰鬥都翻車",
          verse: "該掉的沒掉,不該死的死了,\n隊伍配置怎麼調都不對。\n今天連 Full Auto 都翻車,\n那就是真的不順。",
          good: "停手、明天再來", bad: "硬刷到滿意為止"
        }
      ]
    },
    {
      tier: "大凶", weight: 2, luck: "☆☆☆☆☆ 非酋之王",
      slips: [
        {
          name: "爆死認證",
          verse: "爆死。就是字面上的意思。\n天井花完還是沒有本命,\n金月倒是攢了不少。\n建議關掉遊戲,去外面走走。",
          good: "早點睡、明天再戰", bad: "一切抽卡行為"
        },
        {
          name: "天井之後還是天井",
          verse: "你以為打到天井就結束了,\n換來的還是不對的那張。\n石頭歸零,心情歸零,\n今天請務必遠離轉蛋頁面。",
          good: "登出、去吃點好吃的", bad: "刷卡、補課金"
        },
        {
          name: "小碧都看不下去",
          verse: "連續三十抽全藍,\n小碧在旁邊欲言又止。\n這種日子每個騎空士都遇過,\n撐過去就好。",
          good: "找團友訴苦、休息一天", bad: "任何形式的抽卡"
        },
        {
          name: "木村的道歉信",
          verse: "打開遊戲,首頁是一封道歉信,\n附贈的石頭剛好夠你再爆死一次。\n你收下了石頭,\n然後決定今天不要再打開轉蛋頁面。",
          good: "收下賠償、登出", bad: "用賠償石再抽一輪"
        },
        {
          name: "天井雙爆",
          verse: "兩個天井,兩次落空。\n你開始懷疑自己是不是被系統標記了。\n沒有,只是機率而已 ——\n但這個安慰今天一點用都沒有。",
          good: "離開電腦、去睡", bad: "打第三個天井"
        },
        {
          name: "露莉亞都沉默了",
          verse: "連續四十抽全藍,\n露莉亞在旁邊欲言又止,\n小碧假裝在看別的地方。\n這種時候什麼都不要說最好。",
          good: "休息一天、找團友取暖", bad: "任何形式的抽卡"
        },
        {
          name: "小福也救不了你",
          verse: "就算小福親自在生放送上幫你祈福,\n今天的機率也不會改變。\n這不是誰的錯,\n只是你今天真的不該碰轉蛋。",
          good: "登出、去做別的事", bad: "相信「再一發就好」"
        },
        {
          name: "全部歸零",
          verse: "石頭沒了,票也用完了,\n本命還是沒來,連安慰獎都沒有。\n今天的損失已經無法挽回,\n至少別再加碼。",
          good: "停損、離開", bad: "課金追加"
        }
      ]
    }
  ];

  const ELEMENTS = [
    { name: "火", note: "火屬性隊伍今天特別聽話" },
    { name: "水", note: "水屬性的減傷讓你穩如泰山" },
    { name: "土", note: "土屬性硬是扛住了那一擊" },
    { name: "風", note: "風屬性的連擊今天很給面子" },
    { name: "光", note: "光屬性的回復撐你到最後" },
    { name: "闇", note: "闇屬性的爆發今天很有戲" }
  ];

  function pickFortune() {
    const total = FORTUNES.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    let tier = FORTUNES[FORTUNES.length - 1];
    for (const f of FORTUNES) {
      if (r < f.weight) { tier = f; break; }
      r -= f.weight;
    }
    const slip = tier.slips[Math.floor(Math.random() * tier.slips.length)];
    return { tier, slip };
  }

  function showFortune() {
    const { tier, slip } = pickFortune();
    const el = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];

    // 鴨鴨神的表情跟著籤運走
    duckMood = (tier.tier === "大吉" || tier.tier === "中吉") ? "happy"
             : (tier.tier === "凶" || tier.tier === "大凶") ? "dead"
             : "normal";

    fortuneTierEl.textContent = tier.tier;
    fortuneNameEl.textContent = "「" + slip.name + "」";
    fortuneTierEl.style.color =
      tier.weight <= 3 ? "#b5892f" :
      (tier.tier === "凶" || tier.tier === "大凶") ? "#5a3f85" : "#8a2f26";
    fortuneVerseEl.textContent = slip.verse;
    fortuneLuckEl.textContent = tier.luck;
    fortuneElemEl.textContent = el.name + " — " + el.note;
    fortuneGoodEl.textContent = slip.good;
    fortuneBadEl.textContent = slip.bad;
    fortunePanel.classList.remove("hidden");
    fortunePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------- 丟香油錢 ---------- */

  function makeCoinSprite() {
    const c = document.createElement("canvas");
    c.width = 9; c.height = 9;
    const g = c.getContext("2d");
    const put = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // 仿五円硬幣:圓形帶方孔
    put(2, 0, 5, 1, "#c9971f"); put(1, 1, 7, 1, "#ffd34d");
    put(0, 2, 9, 5, "#ffd34d"); put(1, 7, 7, 1, "#c9971f");
    put(2, 8, 5, 1, "#c9971f");
    put(1, 1, 1, 1, "#fff0a8"); put(0, 2, 1, 3, "#fff0a8");
    put(8, 4, 1, 3, "#a87a12"); put(2, 8, 5, 1, "#a87a12");
    put(3, 3, 3, 3, "#5c4208");
    return c;
  }

  function spawnSparkle(xPct, yPct) {
    const el = document.createElement("div");
    el.className = "sparkle";
    el.textContent = ["✨", "⭐", "💫"][Math.floor(Math.random() * 3)];
    el.style.left = xPct + "%";
    el.style.top = yPct + "%";
    sparkleLayer.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  function shakeScene() {
    shrineWrap.style.transition = "transform 0.06s ease";
    shrineWrap.style.transform = "translate(1px, -1px)";
    setTimeout(() => { shrineWrap.style.transform = "translate(-2px, 1px)"; }, 60);
    setTimeout(() => { shrineWrap.style.transform = "translate(0, 0)"; }, 120);
  }

  let visitCount = 0;
  let animating = false;

  function throwCoin() {
    if (animating) return;
    animating = true;
    throwBtn.disabled = true;
    duckMood = "normal";   // 開抽前先回復平常表情
    getAudio();

    const coin = makeCoinSprite();
    coin.className = "coin-sprite";
    coinLayer.appendChild(coin);

    const wrapRect = shrineWrap.getBoundingClientRect();
    const startX = wrapRect.width * 0.5;
    const startY = wrapRect.height * 1.02;
    const endX = wrapRect.width * ((BOX.x + BOX.w / 2) / W);
    const endY = wrapRect.height * ((BOX.y + 4) / H);
    const arcHeight = wrapRect.height * 0.62;
    const duration = 620;
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t - arcHeight * Math.sin(Math.PI * t);
      coin.style.transform =
        `translate(${x - 9}px, ${y - 9}px) rotate(${t * 900}deg) scale(${1 - 0.3 * t})`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        coin.remove();
        playClink();
        shakeScene();
        const sx = ((BOX.x + BOX.w / 2) / W) * 100;
        const sy = (BOX.y / H) * 100;
        spawnSparkle(sx - 7, sy);
        spawnSparkle(sx + 9, sy - 3);
        spawnSparkle(sx, sy - 7);

        visitCount += 1;
        counterEl.textContent = `今日已參拜 ${visitCount} 次`;

        setTimeout(() => {
          playBell();
          showFortune();
          animating = false;
          throwBtn.disabled = false;
          hint.textContent = "誠心誠意,再丟一次香油錢,聽聽鴨鴨神怎麼說";
        }, 380);
      }
    }
    requestAnimationFrame(frame);
  }

  throwBtn.addEventListener("click", throwCoin);
  againBtn.addEventListener("click", () => {
    fortunePanel.classList.add("hidden");
    throwCoin();
  });
})();
