/* =========================================================
   BASE 26 CLOCK
   Digit values 0–25. Each value is shown as a looping video.
   Put your 26 clips in the /videos folder (see VIDEO_FILES).
   Until a clip exists, the digit shows a letter (0=A ... 25=Z).
   ========================================================= */

// ---- EDIT HERE: which video belongs to which digit value ----
const VIDEO_FILES = Array.from({ length: 26 }, (_, i) => `videos/${i}.mp4`);
// e.g. replace with: ["videos/thumb.mp4", "videos/elbow.mp4", ...]  (26 entries)

const FRAC_DIGITS = 6;     // base-26 digits after the point for non-whole results
const CALC_MAX = 10;       // max digits typed in calculator
const CONV_MAX_26 = 12;    // max base-26 digits typed in converter
const CONV_MAX_10 = 15;    // max base-10 digits typed in converter

const letter = d => String.fromCharCode(65 + d);

/* ---------------- Token rendering ---------------- */
// A token is a number 0–25 (rendered as a video) or a string (rendered as text).
function makeToken(tok) {
  const el = document.createElement("span");
  el.className = "tok";
  el.dataset.tok = typeof tok + ":" + tok;

  if (typeof tok === "number") {
    el.classList.add("digit");
    const v = document.createElement("video");
    v.src = VIDEO_FILES[tok];
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.preload = "auto";
    v.addEventListener("error", () => {
      const fb = document.createElement("span");
      fb.className = "fb";
      fb.textContent = letter(tok);
      el.replaceChildren(fb);
    });
    el.appendChild(v);
    v.play().catch(() => {});
  } else {
    el.classList.add("sym");
    el.textContent = tok === "-" ? "−" : tok === "." ? "·" : tok;
  }
  return el;
}

// Only replaces tokens that changed, so unchanged videos keep playing smoothly.
function render(container, tokens) {
  const kids = Array.from(container.children);
  tokens.forEach((t, i) => {
    const key = typeof t + ":" + t;
    const k = kids[i];
    if (k && k.dataset.tok === key) return;
    const n = makeToken(t);
    k ? container.replaceChild(n, k) : container.appendChild(n);
  });
  for (let i = kids.length - 1; i >= tokens.length; i--) kids[i].remove();
}

/* ---------------- Base 26 math helpers ---------------- */
function bigToDigits(n) {            // BigInt -> array of 0–25
  if (n === 0n) return [0];
  const out = [];
  while (n > 0n) { out.unshift(Number(n % 26n)); n /= 26n; }
  return out;
}
function digitsToBig(arr) {          // array of 0–25 -> BigInt
  return arr.reduce((acc, d) => acc * 26n + BigInt(d), 0n);
}
function numToTokens(x) {            // Number -> tokens (handles negatives, fractions)
  if (!isFinite(x)) return ["E", "R", "R"];
  const neg = x < 0;
  const abs = Math.abs(x);
  const S = Math.pow(26, FRAC_DIGITS);
  let intPart, frac = [];

  if (Number.isInteger(abs) || abs * S > Number.MAX_SAFE_INTEGER) {
    intPart = BigInt(Math.round(abs));
  } else {
    const scaled = Math.round(abs * S);
    intPart = BigInt(Math.floor(scaled / S));
    let rem = scaled % S;
    for (let i = 0; i < FRAC_DIGITS; i++) { frac.unshift(rem % 26); rem = Math.floor(rem / 26); }
    while (frac.length && frac[frac.length - 1] === 0) frac.pop();
  }
  const ints = bigToDigits(intPart);
  const isZero = intPart === 0n && frac.length === 0;
  return [...(neg && !isZero ? ["-"] : []), ...ints, ...(frac.length ? [".", ...frac] : [])];
}

/* ---------------- Keypad builders ---------------- */
function build26Keypad(container, onDigit) {
  container.className = "keypad";
  container.replaceChildren();
  for (let d = 0; d < 26; d++) {
    const b = document.createElement("button");
    b.className = "key";
    b.title = `Digit ${d}`;
    const wrap = document.createElement("span");
    wrap.className = "tokens";
    wrap.appendChild(makeToken(d));
    b.appendChild(wrap);
    b.addEventListener("click", () => onDigit(d));
    container.appendChild(b);
  }
}
function build10Keypad(container, onDigit) {
  container.className = "keypad numerals";
  container.replaceChildren();
  for (let d = 0; d < 10; d++) {
    const b = document.createElement("button");
    b.className = "key";
    b.textContent = d;
    b.addEventListener("click", () => onDigit(d));
    container.appendChild(b);
  }
}
function buildOps(container, list) {   // list: [[symbol, title, handler], ...]
  container.replaceChildren();
  list.forEach(([sym, title, fn]) => {
    const b = document.createElement("button");
    b.className = "sym-btn";
    b.textContent = sym;
    b.title = title;
    b.addEventListener("click", fn);
    container.appendChild(b);
  });
}

/* ---------------- Tabs ---------------- */
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".page").forEach(p =>
      p.classList.toggle("active", p.id === "page-" + tab.dataset.page));
  });
});

/* =========================================================
   TIMER
   ========================================================= */
(() => {
  const resultEl = document.getElementById("timer-result");
  const scaleEl = document.getElementById("scale-display");
  const toggleBtn = document.getElementById("timer-toggle");

  let virtual = 0;          // elapsed "seconds" (scaled)
  let running = false;
  let last = 0;
  let scaleN = 1;           // scaler value
  let multiply = true;      // true: ×N (faster)   false: ÷N (slower)
  let shown = -1;

  const speed = () => (multiply ? scaleN : 1 / scaleN);

  function draw() {
    const whole = Math.floor(virtual);
    if (whole !== shown) { shown = whole; render(resultEl, numToTokens(whole)); }
  }
  function drawScale() {
    render(scaleEl, [multiply ? "×" : "÷", ...bigToDigits(BigInt(scaleN))]);
  }
  function frame(now) {
    if (!running) return;
    virtual += ((now - last) / 1000) * speed();
    last = now;
    draw();
    requestAnimationFrame(frame);
  }

  toggleBtn.addEventListener("click", () => {
    running = !running;
    toggleBtn.textContent = running ? "❚❚" : "▶";
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  document.getElementById("timer-reset").addEventListener("click", () => {
    virtual = 0; shown = -1; draw();
  });
  document.getElementById("scale-up").addEventListener("click", () => {
    scaleN = Math.min(scaleN + 1, 26 * 26 * 26); drawScale();
  });
  document.getElementById("scale-down").addEventListener("click", () => {
    scaleN = Math.max(scaleN - 1, 1); drawScale();
  });
  document.getElementById("scale-mode").addEventListener("click", () => {
    multiply = !multiply; drawScale();
  });

  draw(); drawScale();
})();

/* =========================================================
   CALCULATOR   (all values typed and shown in base 26)
   Root:  A √ B  =  the A-th root of B   (2 √ BA = square root)
   ========================================================= */
(() => {
  const exprEl = document.getElementById("calc-expr");
  const resultEl = document.getElementById("calc-result");
  const calc = { a: null, op: null, entry: [], showResult: false };

  const entryValue = () => Number(digitsToBig(calc.entry));

  function root(n, x) {
    if (n === 0) return NaN;
    if (x < 0) return Number.isInteger(n) && Math.abs(n % 2) === 1 ? -Math.pow(-x, 1 / n) : NaN;
    return Math.pow(x, 1 / n);
  }
  function compute(a, op, b) {
    let r;
    switch (op) {
      case "+": r = a + b; break;
      case "−": r = a - b; break;
      case "×": r = a * b; break;
      case "÷": r = b === 0 ? NaN : a / b; break;
      case "%": r = b === 0 ? NaN : a % b; break;
      case "√": r = root(a, b); break;
    }
    if (!Number.isInteger(r) && Math.abs(r) < 1e9) r = Math.round(r * 1e9) / 1e9;
    return r;
  }

  function draw() {
    let main;
    if (calc.entry.length) main = calc.entry;
    else if (calc.a !== null) main = numToTokens(calc.a);
    else main = [0];
    render(resultEl, main);
    render(exprEl, calc.op && calc.a !== null ? [...numToTokens(calc.a), calc.op] : []);
  }
  function clearAll() { calc.a = null; calc.op = null; calc.entry = []; calc.showResult = false; }

  function pressDigit(d) {
    if (calc.showResult) clearAll();
    if (calc.entry.length >= CALC_MAX) return;
    if (calc.entry.length === 1 && calc.entry[0] === 0) {
      if (d === 0) return;
      calc.entry = [d];
    } else calc.entry.push(d);
    draw();
  }
  function pressOp(o) {
    if (calc.entry.length) {
      const v = entryValue();
      calc.a = calc.a !== null && calc.op && !calc.showResult ? compute(calc.a, calc.op, v) : v;
      calc.entry = [];
    } else if (calc.a === null) return;
    calc.op = o;
    calc.showResult = false;
    draw();
  }
  function pressEquals() {
    if (calc.a === null || !calc.op || !calc.entry.length) return;
    calc.a = compute(calc.a, calc.op, entryValue());
    calc.op = null; calc.entry = []; calc.showResult = true;
    draw();
  }
  function backspace() {
    if (calc.entry.length) { calc.entry.pop(); draw(); }
  }

  buildOps(document.getElementById("calc-ops"), [
    ["+", "Add", () => pressOp("+")],
    ["−", "Subtract", () => pressOp("−")],
    ["×", "Multiply", () => pressOp("×")],
    ["÷", "Divide", () => pressOp("÷")],
    ["%", "Modulus", () => pressOp("%")],
    ["√", "Root (first number is the root, second is the value)", () => pressOp("√")],
    ["=", "Equals", pressEquals],
    ["⌫", "Delete last digit", backspace],
    ["C", "Clear", () => { clearAll(); draw(); }],
  ]);
  build26Keypad(document.getElementById("calc-keys"), pressDigit);
  draw();
})();

/* =========================================================
   CONVERTER   (base 10 <-> base 26)
   ========================================================= */
(() => {
  const labelEl = document.getElementById("conv-label");
  const inputEl = document.getElementById("conv-input");
  const resultEl = document.getElementById("conv-result");
  const keysEl = document.getElementById("conv-keys");

  let to26 = true;     // true: base 10 -> base 26
  let input = [];      // digits typed

  function draw() {
    labelEl.textContent = to26 ? "10 → 26" : "26 → 10";
    if (to26) {
      render(inputEl, input.map(String));
      const n = input.length ? BigInt(input.join("")) : 0n;
      render(resultEl, bigToDigits(n));
    } else {
      render(inputEl, input);
      const n = input.length ? digitsToBig(input) : 0n;
      render(resultEl, n.toString().split(""));
    }
  }
  function press(d) {
    if (input.length >= (to26 ? CONV_MAX_10 : CONV_MAX_26)) return;
    if (input.length === 1 && input[0] === 0) input = [];
    input.push(d);
    draw();
  }
  function buildKeys() { (to26 ? build10Keypad : build26Keypad)(keysEl, press); }

  buildOps(document.getElementById("conv-ops"), [
    ["⌫", "Delete last digit", () => { input.pop(); draw(); }],
    ["C", "Clear", () => { input = []; draw(); }],
  ]);
  document.getElementById("conv-swap").addEventListener("click", () => {
    to26 = !to26; input = [];
    // clear containers so base-10 text and videos never share slots
    inputEl.replaceChildren(); resultEl.replaceChildren();
    buildKeys(); draw();
  });

  buildKeys(); draw();
})();
const focusBtn = document.getElementById("focus-toggle");
focusBtn.addEventListener("click", () => {
  const on = document.body.classList.toggle("focus");
  focusBtn.textContent = on ? "○" : "◉";
});
