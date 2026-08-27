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
    // 綠頭鴨配色 + 黑描邊(描邊是這個風格的關鍵,少了就會糊成一團色塊)
    ink: "#141017",
    green: "#4f7f3f", greenLight: "#6ba055", greenDark: "#2f5a4a",
    collar: "#efe4cd",
    body: "#a9836b", bodyLight: "#c9ad92", bodyPale: "#ded0b8", bodyDark: "#7a5a49",
    speculum: "#6b5560",
    bill: "#f0a03c", billLight: "#ffc067", billDark: "#d97b28",
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
  const BOX = { x: 58, y: 86, w: 44, h: 16 };
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

  // 御幣(祓禊用的幣串),鴨鴨神的神主法器。
  // 紙垂直接貼著幣串左右兩側垂下,不用橫桿 — 橫桿在這個尺寸下會讀成十字架。
  // 御幣改成立在鴨子左側的神具(側身姿勢下鴨子沒有手可以握)
  function drawGohei() {
    const gx = 46;
    rect(gx - 1, 39, 5, 43, C.ink);
    rect(gx, 40, 3, 42, C.gohei);
    rect(gx, 40, 1, 42, "#a87a45");
    rect(gx - 1, 38, 5, 3, C.ink);
    rect(gx, 39, 3, 2, C.gold);

    // 紙垂:單道大鋸齒繞著幣串左右交錯,階距夠大才讀得出是摺紙
    const steps = [[41, 42], [45, 46], [41, 50]];
    steps.forEach(([x, y]) => rect(x - 1, y - 1, 8, 6, C.ink));
    steps.forEach(([x, y]) => {
      rect(x, y, 6, 4, C.robe);
      rect(x, y, 1, 4, C.robeShade);
      rect(x, y, 6, 1, "#ffffff");
    });
    // 台座
    rect(40, 80, 15, 4, C.ink);
    rect(41, 81, 13, 2, C.stoneDark);
  }

  function drawDuck(now) {
    const dy = Math.round(Math.sin(now / 900) * 1.2);          // 呼吸浮動
    const hy = dy + Math.round(Math.sin(now / 1300) * 0.6);    // 光環稍微錯開

    // 側身站姿的綠頭鴨,面向右。身體中心與頭部中心分開:
    // 剪影的辨識度全靠「橢圓身體 + 翹尾 + 細頸 + 長扁喙」這條輪廓線。
    const bx = 76, hx = 90;

    // 後光(對齊頭部,不是畫面中央)
    const gl = ctx.createRadialGradient(hx, 27 + hy, 2, hx, 27 + hy, 15);
    gl.addColorStop(0, "rgba(255,227,107,0.22)");
    gl.addColorStop(1, "rgba(255,227,107,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(hx - 15, 12 + hy, 30, 30);
    ring(hx, 27 + hy, 8, 2.8, 1, C.halo);
    ring(hx, 27 + hy, 6.5, 1.8, 1, C.haloBright);

    // --- 尾羽:尖端朝左上,右半被身體蓋住 ---
    for (let i = 0; i < 8; i++) {
      const y = 60 + i + dy;
      span(y, 56 + i * 0.8 - 1, 71, C.ink);
    }
    for (let i = 0; i < 8; i++) {
      const y = 60 + i + dy;
      span(y, 56 + i * 0.8, 70, C.bodyDark);
    }

    // --- 腳:橘色,蹼向前(下半截被賽錢箱擋住) ---
    [72, 80].forEach(lx => {
      rect(lx - 1, 76 + dy, 5, 12, C.ink);
      rect(lx, 77 + dy, 3, 11, C.bill);
    });

    // --- 身體 ---
    ellipse(bx, 69 + dy, 14, 10, C.ink);
    ellipse(bx, 69 + dy, 13, 9, C.body);
    ellipse(bx, 73 + dy, 10, 5, C.bodyLight);
    // 胸口栗色:不描邊,才會讀成羽色而不是一顆球
    ellipse(85, 67 + dy, 6, 5, "#7c4b3e");

    // --- 收攏的翅膀:淺色覆羽 + 紫色翼鏡 ---
    ellipse(bx - 2, 67 + dy, 9, 5, C.ink);
    ellipse(bx - 2, 67 + dy, 8, 4, C.bodyLight);
    ellipse(bx - 4, 65 + dy, 5, 1.8, C.bodyPale);
    rect(bx - 9, 68 + dy, 13, 1, C.speculum);
    rect(bx - 8, 70 + dy, 11, 1, C.bodyDark);
    rect(bx - 6, 72 + dy, 8, 1, C.bodyDark);

    // --- 頸 ---
    ellipse(87, 56 + dy, 5, 6, C.ink);
    ellipse(87, 56 + dy, 4, 5, C.green);

    // --- 白色頸環:綠頭鴨最好認的特徵 ---
    ellipse(86, 60 + dy, 6, 2.2, C.ink);
    ellipse(86, 60 + dy, 5, 1.5, C.collar);

    // --- 頭:虹彩綠 ---
    ellipse(hx, 47 + dy, 8, 7, C.ink);
    ellipse(hx, 47 + dy, 7, 6, C.green);
    ellipse(hx - 2, 44 + dy, 3.5, 2, C.greenLight);
    ellipse(hx, 52 + dy, 5, 1.8, C.greenDark);

    // --- 長扁喙 ---
    ellipse(102, 47 + dy, 6.5, 3.5, C.ink);
    ellipse(102, 47 + dy, 6, 2.6, C.bill);
    rect(97, 45 + dy, 10, 1, C.billLight);
    ellipse(102, 49 + dy, 5, 1, C.billDark);
    rect(107, 46 + dy, 2, 2, C.ink);
    rect(99, 46 + dy, 1, 1, C.billDark);

    // 眼睛
    rect(92, 44 + dy, 3, 4, C.ink);
    rect(92, 44 + dy, 1, 1, "#ffffff");

    // --- 立烏帽子:窄身、戴在頭的後半,前額的綠色要留出來,
    //     否則帽子會把整顆頭蓋掉,綠頭鴨的特徵就沒了 ---
    [[82, 91, 39, 3], [82, 90, 36, 3], [81, 88, 33, 3], [81, 87, 30, 3]]
      .forEach(([l, r, y, h]) => {
        rect(l - 1, y + dy, r - l + 2, h, C.ink);
        rect(l, y + dy, r - l, h, C.hat);
        rect(l, y + dy, 1, h, C.hatLight);
      });
    rect(82, 39 + dy, 9, 1, C.hatLight);
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
    const { x, y, w, h } = BOX;
    rect(x - 2, y - 2, w + 4, 3, C.woodDark);
    rect(x, y, w, h, C.wood);
    rect(x, y, w, 2, C.woodLight);
    for (let i = 1; i < 5; i++) rect(x + i * 9, y, 1, h, C.woodPlank);
    rect(x + 10, y + 3, 24, 3, "#1a0f08");
    rect(x + 11, y + 4, 22, 1, "#000000");
    rect(x - 4, y + h, w + 8, 3, "#33220f");
  }

  function renderScene(now) {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawStars(now);
    drawMoon();
    drawGround();
    drawTorii();
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

  const FORTUNES = [
    {
      tier: "大吉", name: "天選騎空士", weight: 3,
      luck: "★★★★★ 歐氣衝破天井",
      verse: "彩虹光直接閃瞎你的眼,\n單抽就把 UP 角帶回家。\n連緋緋色金都想主動來找你,\n今天不抽對不起自己。",
      good: "十連、追本命 UP、開限定池", bad: "猶豫、關掉遊戲"
    },
    {
      tier: "中吉", name: "金光連發", weight: 10,
      luck: "★★★★☆ 手氣正順",
      verse: "金光閃了好幾次,\nSSR 出現的頻率高得不像話。\n雖然還沒摸到天井,\n但你已經比隔壁團長幸運多了。",
      good: "十連、刷素材、開箱", bad: "分心、手滑點錯"
    },
    {
      tier: "小吉", name: "安穩出貨", weight: 17,
      luck: "★★★☆☆ 穩穩過關",
      verse: "該出的都會出,只是慢了點。\n不會爆死,但也別期待奇蹟。\n今天適合安穩地養角色,\n順便把每日任務做一做。",
      good: "每日免費單抽、日常任務", bad: "大額課金"
    },
    {
      tier: "吉", name: "騎空士的日常", weight: 25,
      luck: "★★★☆☆ 普通的一天",
      verse: "平常心就好,今天沒什麼特別的。\n金月藍月默默地累積,\n素材慢慢攢,總有畢業的一天。\n騎空士的日常就是這樣。",
      good: "存石、刷古戰場、肝素材", bad: "梭哈全部身家"
    },
    {
      tier: "半吉", name: "歪了", weight: 20,
      luck: "★★☆☆☆ 喜憂參半",
      verse: "有出貨,但歪了。\n你想要的沒來,\n別人的本命倒是來了三張。\n先拿去換金月吧,至少不算白花。",
      good: "存石觀望、等下個池", bad: "不甘心再加抽"
    },
    {
      tier: "末吉", name: "勉強及格", weight: 15,
      luck: "★★☆☆☆ 勉強及格",
      verse: "十連開出一片藍,\n偶爾有個金光,結果還是 SR。\n天井還很遠,錢包已經在痛,\n先求平安別爆死。",
      good: "小額娛樂、放寬心", bad: "熬夜肝本"
    },
    {
      tier: "凶", name: "非酋附體", weight: 8,
      luck: "★☆☆☆☆ 非酋附體",
      verse: "藍色、藍色、還是藍色,\n連個金光都吝嗇給你。\n螢幕上映出你空洞的表情,\n今天真的不是抽卡的日子。",
      good: "存石、等天井、去睡覺", bad: "課金、賭一把"
    },
    {
      tier: "大凶", name: "爆死認證", weight: 2,
      luck: "☆☆☆☆☆ 非酋之王",
      verse: "爆死。就是字面上的意思。\n天井花完還是沒有本命,\n金月倒是攢了不少。\n建議關掉遊戲,去外面走走。",
      good: "早點睡、明天再戰", bad: "一切抽卡行為"
    }
  ];

  function pickFortune() {
    const total = FORTUNES.reduce((s, f) => s + f.weight, 0);
    let r = Math.random() * total;
    for (const f of FORTUNES) {
      if (r < f.weight) return f;
      r -= f.weight;
    }
    return FORTUNES[FORTUNES.length - 1];
  }

  function showFortune() {
    const f = pickFortune();
    fortuneTierEl.textContent = f.tier;
    fortuneNameEl.textContent = "「" + f.name + "」";
    fortuneTierEl.style.color =
      f.weight <= 3 ? "#b5892f" :
      (f.tier === "凶" || f.tier === "大凶") ? "#5a3f85" : "#8a2f26";
    fortuneVerseEl.textContent = f.verse;
    fortuneLuckEl.textContent = f.luck;
    fortuneGoodEl.textContent = f.good;
    fortuneBadEl.textContent = f.bad;
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
