/* ---------------------------------------------------------------
   Question generators.
   Each entry in GENERATORS is a function that returns a fresh,
   randomized instance of one quiz question: new numbers, a freshly
   computed correct answer, and freshly shuffled options. Calling the
   same generator twice gives two different-looking questions that
   test the exact same math idea — that's what lets a retake avoid
   repeating memorized answers, and what lets the "review missed"
   screen hand back a brand new version of a question you got wrong.
   --------------------------------------------------------------- */

(function (global) {
  "use strict";

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function choice(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
  function nf(n) { return n.toLocaleString("en-US"); }
  function signed(n) { return n < 0 ? "−" + nf(Math.abs(n)) : nf(n); }

  const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  function sup(n) { return String(n).split("").map(d => SUP[d]).join(""); }
  function supExp(n) { return n < 0 ? "⁻" + sup(-n) : sup(n); }

  function fracReduce(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return [n / g, d / g];
  }
  function fracStr(n, d) {
    [n, d] = fracReduce(n, d);
    const neg = n < 0; n = Math.abs(n);
    if (d === 1) return (neg ? "−" : "") + n;
    const whole = Math.floor(n / d), rem = n - whole * d;
    if (whole === 0) return (neg ? "−" : "") + rem + "/" + d;
    if (rem === 0) return (neg ? "−" : "") + whole;
    return (neg ? "−" : "") + whole + " " + rem + "/" + d;
  }
  function shiftDecimal(digits, places) {
    const neg = digits < 0;
    let s = String(Math.abs(digits));
    while (s.length <= places) s = "0" + s;
    if (places === 0) return (neg ? "-" : "") + s;
    const cut = s.length - places;
    return (neg ? "-" : "") + s.slice(0, cut) + "." + s.slice(cut);
  }

  function dedupeKey(s) { return String(s).replace(/-(\d)/g, "−$1"); }
  function uniq3(correct, gens) {
    const set = new Set([dedupeKey(correct)]);
    const out = [];
    for (const g of gens) {
      let v = String(g());
      let guard = 0;
      while (set.has(dedupeKey(v)) && guard < 12) { v = v + "​"; guard++; }
      set.add(dedupeKey(v));
      out.push(v);
    }
    return out;
  }

  function retry(fn, tries) {
    tries = tries || 300;
    for (let i = 0; i < tries; i++) {
      const r = fn();
      if (r) return r;
    }
    throw new Error("generator retry exhausted");
  }

  function Q(topic, prompt, correct, distractors, hint, why, ok, no) {
    const opts = shuffle([{ t: String(correct), c: true }].concat(distractors.map(d => ({ t: String(d), c: false }))));
    return {
      topic, prompt,
      options: opts.map(o => o.t),
      correct: opts.findIndex(o => o.c),
      hint, why, ok, no
    };
  }

  const GENERATORS = [];

  /* 1. Prime numbers — spot the prime */
  GENERATORS.push(function () {
    const d = choice([3, 5, 7]);
    const primesPool = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97].filter(p => p % d !== 0);
    const P = choice(primesPool);
    const ks = shuffle(Array.from({ length: 12 }, (_, i) => i + 2)).slice(0, 3);
    const composites = ks.map(k => d * k).sort((a, b) => a - b);
    const options = shuffle(composites.concat([P]));
    const why = composites.map(c => `${c} = ${d} × ${c / d}`).join(", ");
    return {
      topic: "Prime numbers",
      prompt: "Which of these numbers is prime?",
      options: options.map(String),
      correct: options.indexOf(P),
      hint: "A prime number has exactly two factors: 1 and itself. Try dividing each option by " + d + ".",
      why: `<span class='expr'>${why}</span> all divide evenly by ${d}. ${P} has no factors besides 1 and ${P}, so it is prime.`,
      ok: "Correctly spotted.",
      no: "Check whether each option divides evenly by " + d + "."
    };
  });

  /* 2. Prime numbers — prime factorization of a²·b·c */
  GENERATORS.push(function () {
    const a = choice([2, 3]);
    const rest = [2, 3, 5, 7, 11].filter(x => x !== a);
    const [b, c] = shuffle(rest).slice(0, 2);
    const N = a * a * b * c;
    const correct = `${a}² × ${b} × ${c}`;
    const d1 = `${a} × ${b} × ${a * c}`;
    const d2 = `${a} × ${b * b} × ${c}`;
    const d3 = `${a * a} × ${b} × ${c}`;
    return Q("Prime numbers", `What is the prime factorization of ${N}?`,
      correct, [d1, d2, d3],
      `Keep splitting until every factor is prime. ${a * c} and ${a * a} are not prime.`,
      `Split it down: <span class='expr'>${N} = ${a * a} × ${b * c} = (${a} × ${a}) × (${b} × ${c})</span>, which is <span class='expr'>${a}² × ${b} × ${c}</span>. The other options stop early and leave a composite factor behind.`,
      "Broken all the way down.",
      "Check whether every factor in your answer is actually prime.");
  });

  /* 3. Factors & multiples — GCF */
  GENERATORS.push(function () {
    const g = choice([6, 8, 10, 12, 14, 15, 18, 20]);
    const divisors = [];
    for (let i = 2; i < g; i++) if (g % i === 0) divisors.push(i);
    const [d1, d2] = shuffle(divisors).slice(0, 2);
    let m, n;
    do { m = rnd(2, 6); n = rnd(2, 6); } while (m === n || gcd(m, n) !== 1);
    const A = g * m, B = g * n, L = g * m * n;
    return Q("Factors & multiples", `What is the greatest common factor (GCF) of ${A} and ${B}?`,
      g, [d1, d2, L],
      "List the factors of each number and find the biggest one they share.",
      `Factors of ${A}: ${factorsOf(A).join(", ")}. Factors of ${B}: ${factorsOf(B).join(", ")}. The largest they share is ${g}. Note that ${L} is the least common <span class='expr'>multiple</span>, not a factor.`,
      "Correct.",
      "You're looking for the largest factor both numbers share.");
  });
  function factorsOf(n) { const out = []; for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i); return out; }

  /* 4. Factors & multiples — LCM */
  GENERATORS.push(function () {
    let A, B;
    do { A = rnd(4, 20); B = rnd(4, 20); } while (A === B || gcd(A, B) === 1);
    const L = lcm(A, B), G = gcd(A, B), S = A + B, P = A * B;
    const distractors = uniq3(L, [() => G, () => S, () => P]);
    return Q("Factors & multiples", `What is the least common multiple (LCM) of ${A} and ${B}?`,
      L, distractors,
      `Count up by ${A}s and by ${B}s until you hit the same number.`,
      `The least common multiple of ${A} and ${B} is ${L}. Multiplying them gives ${P}, which is a common multiple but not the <span class='expr'>least</span> one.`,
      "Smallest one found.",
      "Multiplying the two numbers gives a common multiple, but not the smallest.");
  });

  /* 5. Fractions — add */
  GENERATORS.push(function () {
    const denoms = [2, 3, 4, 5, 6, 7, 8, 9];
    let b, d2;
    do { b = choice(denoms); d2 = choice(denoms); } while (b === d2);
    const a = rnd(1, b - 1), c = rnd(1, d2 - 1);
    const num = a * d2 + c * b, den = b * d2;
    const correct = fracStr(num, den);
    const straight = fracStr(a + c, b + d2);
    const noConvert = fracStr(a * d2 + c, den);
    const denomOnly = fracStr(a + c, den);
    const distractors = uniq3(correct, [() => straight, () => noConvert, () => denomOnly]);
    return Q("Fractions", `What is <span class='expr'>${a}/${b} + ${c}/${d2}</span>?`,
      correct, distractors,
      "You can't add fractions until the denominators match. Rewrite both over a common denominator.",
      `<span class='expr'>${a}/${b} = ${a * d2}/${den}</span> and <span class='expr'>${c}/${d2} = ${c * b}/${den}</span>, so the sum is <span class='expr'>${correct}</span>. Adding tops and bottoms straight across gives ${straight}, which is a common mistake.`,
      "Denominators handled.",
      "Never add the denominators straight across.");
  });

  /* 6. Fractions — divide */
  GENERATORS.push(function () {
    const b = choice([3, 4, 5, 6, 7, 8, 9]);
    const a = rnd(1, b - 1);
    const d2 = choice([2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== b));
    const c = rnd(1, d2 - 1);
    const num = a * d2, den = b * c;
    const correct = fracStr(num, den);
    const noFlip = fracStr(a * c, b * d2);
    const flippedFirst = fracStr(b * c, a * d2);
    const swapped = fracStr(c * b, d2 * a);
    const distractors = uniq3(correct, [() => noFlip, () => flippedFirst, () => swapped]);
    return Q("Fractions", `What is <span class='expr'>${a}/${b} ÷ ${c}/${d2}</span>?`,
      correct, distractors,
      "Dividing by a fraction is the same as multiplying by its reciprocal — flip the second one.",
      `Flip and multiply: <span class='expr'>${a}/${b} × ${d2}/${c} = ${num}/${den}</span>, which reduces to <span class='expr'>${correct}</span>. Multiplying without flipping gives ${noFlip}.`,
      "Flipped correctly.",
      "Flip the second fraction, then multiply.");
  });

  /* 7. Decimals — multiply */
  GENERATORS.push(function () {
    let x1;
    do { x1 = rnd(11, 49); } while (x1 % 10 === 0);
    const x2 = rnd(2, 9);
    const raw = x1 * x2;
    const correct = shiftDecimal(raw, 2);
    const d1 = shiftDecimal(raw, 3), d2 = shiftDecimal(raw, 1), d3 = shiftDecimal(raw, 0);
    const A = shiftDecimal(x1, 1), B = shiftDecimal(x2, 1);
    return Q("Decimals", `What is <span class='expr'>${A} × ${B}</span>?`,
      correct, [d1, d2, d3],
      "Multiply as if there were no decimal points, then count the total decimal places.",
      `<span class='expr'>${x1} × ${x2} = ${raw}</span>. There is 1 decimal place in ${A} and 1 in ${B}, so 2 in total, giving <span class='expr'>${correct}</span>.`,
      "Decimal placed correctly.",
      "Count the decimal places in both numbers being multiplied.");
  });

  /* 8. Decimals — divide */
  GENERATORS.push(function () {
    let qRaw;
    do { qRaw = rnd(11, 99); } while (qRaw % 10 === 0);
    const bRaw = rnd(2, 9);
    const dividendRaw = qRaw * bRaw;
    const correct = shiftDecimal(qRaw, 2);
    const d1 = shiftDecimal(qRaw, 3), d2 = shiftDecimal(qRaw, 1), d3 = shiftDecimal(qRaw, 0);
    const dividend = shiftDecimal(dividendRaw, 3), divisor = shiftDecimal(bRaw, 1);
    return Q("Decimals", `What is <span class='expr'>${dividend} ÷ ${divisor}</span>?`,
      correct, [d1, d2, d3],
      "Move the decimal point in both numbers until the one you're dividing by is a whole number.",
      `Multiply both by 10 to clear the divisor: <span class='expr'>${shiftDecimal(dividendRaw, 2)} ÷ ${bRaw} = ${correct}</span>. Shifting both numbers the same amount leaves the answer unchanged.`,
      "Handled the divisor cleanly.",
      "Shift both numbers by the same number of places first.");
  });

  /* 9. Rounding — nearest tenth */
  GENERATORS.push(function () {
    const W = rnd(1, 9), A = rnd(0, 8), B = rnd(0, 9), C = rnd(1, 9);
    const num = `${W}.${A}${B}${C}`;
    const roundUp = B >= 5;
    const correctTenths = roundUp ? A + 1 : A;
    const correct = correctTenths === 10 ? `${W + 1}.0` : `${W}.${correctTenths}`;
    const hRound = C >= 5 ? B + 1 : B;
    const hundredthsStr = hRound === 10 ? `${W}.${A + 1}0` : `${W}.${A}${hRound}`;
    const oppTenths = roundUp ? A : A + 1;
    const oppStr = oppTenths === 10 ? `${W + 1}.0` : `${W}.${oppTenths}`;
    const wholeRound = (A >= 5 ? W + 1 : W) + ".0";
    const distractors = uniq3(correct, [() => hundredthsStr, () => oppStr, () => wholeRound]);
    return Q("Rounding & estimation", `Round ${num} to the nearest tenth.`,
      correct, distractors,
      "The tenths place is the first digit after the decimal point. Look at the digit just after it to decide.",
      `The tenths digit is ${A}, and the digit after it is ${B}, which is ${roundUp ? "5 or more, so round up to " + correct : "less than 5, so it stays " + correct}. Rounding to ${hundredthsStr} stops at the hundredths place instead.`,
      "Rounded correctly.",
      "Check which place value the tenths actually is.");
  });

  /* 10. Estimation */
  GENERATORS.push(function () {
    const base1 = choice([20, 30, 40, 50, 60, 70, 80, 90]);
    const base2 = choice([3, 4, 5, 6, 7, 8, 9]);
    const A = +(base1 + choice([-0.3, -0.2, -0.1, 0.1, 0.2, 0.3])).toFixed(1);
    const B = +(base2 + choice([-0.3, -0.2, -0.1, 0.1, 0.2, 0.3])).toFixed(1);
    const est = base1 * base2;
    const exact = Math.round(A * B * 100) / 100;
    const distractors = uniq3(est, [() => est / 10, () => est * 10, () => Math.round(exact)]);
    return Q("Rounding & estimation", `Without a calculator, which is the best estimate of <span class='expr'>${A} × ${B}</span>?`,
      est, distractors,
      "Round each number to something easy first, then multiply.",
      `Round to <span class='expr'>${base1} × ${base2} = ${est}</span>. The exact answer is ${exact}, so ${est} is close. Estimating like this is the fastest way to rule out wrong multiple-choice answers on a timed test.`,
      "Good estimate.",
      "Round each number to the nearest whole ten or one first.");
  });

  /* 11. Negative numbers — order of ops with a product */
  GENERATORS.push(function () {
    const a = rnd(3, 12), b = rnd(2, 6), c = rnd(2, 6);
    const mul = b * c;
    const correct = -a + -mul;
    const wrongOrder = (-a + b) * -c;
    const signError = -a - -mul;
    const both = -a - mul;
    const distractors = uniq3(correct, [() => wrongOrder, () => signError, () => both]);
    return Q("Negative numbers", `What is <span class='expr'>−${a} + ${b} × (−${c})</span>?`,
      correct, distractors,
      "Multiply before you add, and watch the signs.",
      `Multiplication first: <span class='expr'>${b} × (−${c}) = −${mul}</span>. Then <span class='expr'>−${a} + (−${mul}) = ${correct}</span>.`,
      "Signs handled correctly.",
      "Do the multiplication before the addition.");
  });

  /* 12. Negative numbers — cube plus product */
  GENERATORS.push(function () {
    const a = rnd(2, 5), b = rnd(2, 9), c = rnd(2, 9);
    const cube = -(a * a * a), prod = b * c;
    const correct = cube + prod;
    const noCubeSign = (a * a * a) + prod;
    const noProdSign = cube - prod;
    const both = (a * a * a) - prod;
    const distractors = uniq3(correct, [() => noCubeSign, () => noProdSign, () => both]);
    return Q("Negative numbers", `What is <span class='expr'>(−${a})³ + (−${b})(−${c})</span>?`,
      correct, distractors,
      "An odd power of a negative stays negative. Two negatives multiplied give a positive.",
      `<span class='expr'>(−${a})³ = −${a} × −${a} × −${a} = −${a * a * a}</span>, and <span class='expr'>(−${b})(−${c}) = ${prod}</span>. So <span class='expr'>−${a * a * a} + ${prod} = ${correct}</span>.`,
      "Both signs tracked.",
      "Check the sign on the cube first.");
  });

  /* 13. Absolute value — basic */
  GENERATORS.push(function () {
    const n = rnd(2, 15);
    const distractors = uniq3(n, [() => -n, () => 0, () => 2 * n]);
    return Q("Absolute value", `What is <span class='expr'>|−${n}|</span>?`,
      n, distractors,
      "Absolute value is the distance from zero, and distance is never negative.",
      `−${n} sits ${n} units from zero on the number line, so its absolute value is ${n}. The bars strip the sign; they don't double the number.`,
      "Correct.",
      "Absolute value asks how far from zero, ignoring direction.");
  });

  /* 14. Absolute value — combined */
  GENERATORS.push(function () {
    const a = rnd(1, 6), b = rnd(a + 3, a + 12), c = rnd(2, 9);
    const inner1 = a - b, abs1 = Math.abs(inner1);
    const correct = abs1 + c;
    const noAbs = inner1 + c;
    const negAnswer = -correct;
    const subC = abs1 - c;
    const distractors = uniq3(correct, [() => noAbs, () => negAnswer, () => subC]);
    return Q("Absolute value", `What is <span class='expr'>|${a} − ${b}| + |−${c}|</span>?`,
      correct, distractors,
      "Work out what's inside each set of bars first, then take the absolute value of each.",
      `Inside the first bars: <span class='expr'>${a} − ${b} = −${abs1}</span>, so <span class='expr'>|−${abs1}| = ${abs1}</span>. The second gives <span class='expr'>|−${c}| = ${c}</span>. Then <span class='expr'>${abs1} + ${c} = ${correct}</span>. Simplify inside the bars before stripping the sign.`,
      "Both parts handled.",
      "Simplify inside the bars first, then take absolute values.");
  });

  /* 15. Order of operations — basic */
  GENERATORS.push(function () {
    const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9);
    const correct = a + b * c;
    const leftToRight = (a + b) * c;
    const distractors = uniq3(correct, [() => leftToRight, () => a * b + c, () => a + b + c]);
    return Q("Order of operations", `What is <span class='expr'>${a} + ${b} × ${c}</span>?`,
      correct, distractors,
      "Multiplication comes before addition, no matter which is written first.",
      `Multiply first: <span class='expr'>${b} × ${c} = ${b * c}</span>, then <span class='expr'>${a} + ${b * c} = ${correct}</span>. Working strictly left to right gives ${leftToRight}, which is the trap.`,
      "Order respected.",
      "Left to right isn't the rule — multiplication comes first.");
  });

  /* 16. Order of operations — parens, exponent, divide, add */
  GENERATORS.push(function () {
    const a = rnd(5, 12), b = rnd(1, a - 1);
    const base = a - b, sq = base * base;
    const cCandidates = [2, 3, 4, 5].filter(cc => sq % cc === 0);
    const c = cCandidates.length ? choice(cCandidates) : 1;
    const d = rnd(1, 9);
    const divided = sq / c;
    const correct = divided + d;
    const addFirst = (sq + d) / c;
    const distractors = uniq3(correct, [() => Math.round(addFirst), () => sq + d, () => divided]);
    return Q("Order of operations", `What is <span class='expr'>(${a} − ${b})² ÷ ${c} + ${d}</span>?`,
      correct, distractors,
      "Parentheses, then the exponent, then divide, then add.",
      `Parentheses: <span class='expr'>${a} − ${b} = ${base}</span>. Exponent: <span class='expr'>${base}² = ${sq}</span>. Divide: <span class='expr'>${sq} ÷ ${c} = ${divided}</span>. Add: <span class='expr'>${divided} + ${d} = ${correct}</span>. Adding before dividing would give ${sq + d}.`,
      "All four steps in order.",
      "Finish the division before you add.");
  });

  /* 17. Exponents — numeric power */
  GENERATORS.push(function () {
    const n = rnd(2, 6), e = choice([2, 3, 4]);
    const correct = Math.pow(n, e);
    const mulMistake = n * e;
    const oneLess = Math.pow(n, e - 1);
    const oneMore = Math.pow(n, e + 1);
    const distractors = uniq3(correct, [() => mulMistake, () => oneLess, () => oneMore]);
    return Q("Exponents", `What is <span class='expr'>${n}${sup(e)}</span>?`,
      correct, distractors,
      `That's ${e} ${n}s multiplied together, not ${n} times ${e}.`,
      `<span class='expr'>${Array(e).fill(n).join(" × ")} = ${correct}</span>. Multiplying the base by the exponent gives ${mulMistake}, which is the classic misread.`,
      "Correct.",
      "An exponent means repeated multiplication, not multiplying base by exponent.");
  });

  /* 18. Exponents — like bases */
  GENERATORS.push(function () {
    const a = rnd(2, 7), b = rnd(2, 7);
    const correct = `x${sup(a + b)}`;
    const mulExp = `x${sup(a * b)}`;
    const coeff = `2x${sup(a + b)}`;
    const subExp = `x${sup(Math.abs(a - b) || 1)}`;
    const distractors = uniq3(correct, [() => mulExp, () => coeff, () => subExp]);
    return Q("Exponents", `Simplify: <span class='expr'>x${sup(a)} · x${sup(b)}</span>`,
      correct, distractors,
      "Write it out as x's multiplied together and count them.",
      `${a} x's times ${b} x's is ${a + b} x's: <span class='expr'>${correct}</span>. When multiplying powers of the same base you add the exponents; multiplying them gives ${mulExp}, which is a different rule entirely.`,
      "Rule applied correctly.",
      "Add the exponents when multiplying like bases.");
  });

  /* 19. Square roots — perfect square */
  GENERATORS.push(function () {
    const n = rnd(4, 20), sq = n * n;
    const distractors = uniq3(n, [() => n - 1, () => n + 1, () => sq / 2]);
    return Q("Square roots", `What is <span class='expr'>√${sq}</span>?`,
      n, distractors,
      `What number, multiplied by itself, gives ${sq}?`,
      `<span class='expr'>${n} × ${n} = ${sq}</span>, so <span class='expr'>√${sq} = ${n}</span>. Halving ${sq} gives ${sq / 2}, which is a different operation entirely.`,
      "Correct.",
      "Try squaring each option to test it.");
  });

  /* 20. Square roots — simplify radical */
  GENERATORS.push(function () {
    const k = choice([2, 3, 5, 6, 7]), m = choice([2, 3, 4, 5]);
    const N = m * m * k;
    const correct = `${m}√${k}`;
    const wrongFactor = `${m === 2 ? 3 : 2}√${k}`;
    const overExtract = `${m * m}√${k}`;
    const noExtract = `${m}√${k * m}`;
    const distractors = uniq3(correct, [() => wrongFactor, () => overExtract, () => noExtract]);
    return Q("Square roots", `Which of these is <span class='expr'>√${N}</span> in simplest radical form?`,
      correct, distractors,
      `Look for the largest perfect square that divides ${N}.`,
      `<span class='expr'>${N} = ${m * m} × ${k}</span>, and ${m * m} is a perfect square, so <span class='expr'>√${N} = √${m * m} × √${k} = ${m}√${k}</span>.`,
      "Simplified properly.",
      "Pull out the perfect square factor.");
  });

  /* 21. Scientific notation — to standard form */
  GENERATORS.push(function () {
    const lead = rnd(1, 9), dec = rnd(0, 9), n = rnd(2, 5);
    const mantissa = dec === 0 ? `${lead}` : `${lead}.${dec}`;
    const digitsBase = String(lead) + String(dec);
    const build = shift => nf(Number(digitsBase + "0".repeat(shift - 1)));
    const correct = build(n);
    const distractors = uniq3(correct, [() => build(n - 1), () => build(n + 1), () => build(n + 2)]);
    return Q("Scientific notation", `Write <span class='expr'>${mantissa} × 10${sup(n)}</span> in standard form.`,
      correct, distractors,
      "The exponent tells you how many places to move the decimal point to the right.",
      `Moving the decimal ${n} places right turns ${mantissa} into ${correct}. Equivalently, <span class='expr'>${mantissa} × ${nf(Math.pow(10, n))} = ${correct}</span>.`,
      "Correct.",
      "Count the decimal places you moved.");
  });

  /* 22. Scientific notation — from a small decimal */
  GENERATORS.push(function () {
    const lead = rnd(1, 9), dec = rnd(1, 9), zeros = rnd(2, 5);
    const decimalStr = "0." + "0".repeat(zeros) + `${lead}${dec}`;
    const exp = -(zeros + 1);
    const correct = `${lead}.${dec} × 10${supExp(exp)}`;
    const offByOne = `${lead}.${dec} × 10${supExp(exp + 1)}`;
    const twoDigits = `${lead}${dec} × 10${supExp(exp - 1)}`;
    const wrongSign = `${lead}.${dec} × 10${supExp(-exp)}`;
    const distractors = uniq3(correct, [() => offByOne, () => twoDigits, () => wrongSign]);
    return Q("Scientific notation", `Write ${decimalStr} in scientific notation.`,
      correct, distractors,
      "Move the decimal until exactly one non-zero digit sits in front of it, then count the moves. Small numbers take a negative exponent.",
      `Moving the decimal ${zeros + 1} places right gives ${lead}.${dec}, so the exponent is <span class='expr'>−${zeros + 1}</span>. The ${lead}${dec} version has two digits before the decimal, which isn't proper scientific notation.`,
      "Notation correct.",
      "Exactly one non-zero digit belongs in front of the decimal.");
  });

  /* 23. Patterns — geometric */
  GENERATORS.push(function () {
    const r = choice([2, 3, 4]), start = rnd(1, 5);
    const terms = [start, start * r, start * r * r, start * r * r * r];
    const next = terms[3] * r;
    const additionTrap = terms[3] + (terms[3] - terms[2]);
    const wrongRatio = terms[3] * (r === 2 ? 3 : 2);
    const halfNext = terms[3] + start;
    const distractors = uniq3(next, [() => additionTrap, () => wrongRatio, () => halfNext]);
    return Q("Patterns", `What comes next in the pattern? ${terms.join(", ")}, ___`,
      next, distractors,
      "Look at what each term is multiplied by, not what's added.",
      `Each term is multiplied by ${r}: <span class='expr'>${terms.join(" → ")}</span>, so the next is <span class='expr'>${terms[3]} × ${r} = ${next}</span>.`,
      "Spotted the pattern.",
      "Check for multiplication rather than addition.");
  });

  /* 24. Patterns — double plus one */
  GENERATORS.push(function () {
    const start = rnd(2, 5);
    const terms = [start];
    for (let i = 0; i < 3; i++) terms.push(terms[terms.length - 1] * 2 + 1);
    const next = terms[3] * 2 + 1;
    const diffs = [terms[1] - terms[0], terms[2] - terms[1], terms[3] - terms[2]];
    const nextDiff = diffs[2] * 2;
    const linearTrap = terms[3] + diffs[2];
    const noPlusOne = terms[3] * 2;
    const distractors = uniq3(next, [() => linearTrap, () => noPlusOne, () => next + 1]);
    return Q("Patterns", `What comes next in the pattern? ${terms.join(", ")}, ___`,
      next, distractors,
      `The gaps between terms are ${diffs.join(", ")}. What comes next in that list?`,
      `The differences double each time: ${diffs.join(", ")}, then ${nextDiff}. So <span class='expr'>${terms[3]} + ${nextDiff} = ${next}</span>. Another way to see it: each term is double the one before, plus 1.`,
      "Found the rule.",
      "Look at the differences between terms, then at how those differences change.");
  });

  /* 25. Percents — sale price */
  GENERATORS.push(function () {
    const { price, pct, discount, sale } = retry(function () {
      const price = choice([20, 24, 32, 40, 48, 60, 64, 80, 100]);
      const pct = choice([10, 15, 20, 25, 30]);
      const discount = price * pct / 100;
      if (!Number.isInteger(discount)) return null;
      return { price, pct, discount, sale: price - discount };
    });
    const distractors = uniq3(sale, [() => discount, () => price + discount, () => price - Math.round(discount / 2)]);
    return Q("Percents", `A jacket normally costs $${price}. It is on sale for ${pct}% off. What is the sale price?`,
      "$" + sale, distractors.map(d => "$" + d),
      `${pct}% off means you still pay ${100 - pct}% of the original price.`,
      `${pct}% of $${price} is $${discount}, so the sale price is <span class='expr'>${price} − ${discount} = $${sale}</span>. Shortcut: <span class='expr'>${(1 - pct / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "")} × ${price} = ${sale}</span>.`,
      "Exactly right.",
      "The discount isn't the answer — subtract it from the original.");
  });

  /* 26. Percents — find the original price */
  GENERATORS.push(function () {
    const { orig, pct, final } = retry(function () {
      const orig = choice([30, 40, 45, 50, 60, 75, 80, 90, 100, 120]);
      const pct = choice([10, 15, 20, 25, 30, 40]);
      const final = orig * (1 - pct / 100);
      if (!Number.isInteger(final)) return null;
      return { orig, pct, final };
    });
    const addBack = final + final * pct / 100;
    const distractors = uniq3(orig, [() => Math.round(addBack * 100) / 100, () => orig + (orig - final), () => final + pct]);
    return Q("Percents", `After a ${pct}% discount, an item costs $${final}. What was the original price?`,
      "$" + orig, distractors.map(d => "$" + d),
      `$${final} represents ${100 - pct}% of the original, not 100%. Work backwards.`,
      `If the price dropped ${pct}%, then $${final} is ${100 - pct}% of the original: <span class='expr'>${(1 - pct / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "")}x = ${final}</span>, so <span class='expr'>x = ${final} ÷ ${(1 - pct / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "")} = $${orig}</span>. Adding ${pct}% back onto $${final} gives $${Math.round(addBack * 100) / 100}, which is the classic trap — percentages are taken from different starting numbers.`,
      "Worked backwards correctly.",
      "Adding the percent back on doesn't undo the discount.");
  });

  /* 27. Ratio & rate — unit rate scale-up */
  GENERATORS.push(function () {
    const rate = rnd(15, 40), G = rnd(3, 8);
    let G2;
    do { G2 = rnd(3, 12); } while (G2 === G);
    const A = rate * G, correct = rate * G2;
    const distractors = uniq3(correct, [() => correct + rate, () => correct - rate, () => A + G2]);
    return Q("Ratio & rate", `A car travels ${A} miles on ${G} gallons of gas. At the same rate, how far can it travel on ${G2} gallons?`,
      correct + " miles", distractors.map(d => d + " miles"),
      "Find the miles per gallon first.",
      `<span class='expr'>${A} ÷ ${G} = ${rate}</span> miles per gallon, and <span class='expr'>${rate} × ${G2} = ${correct}</span> miles.`,
      "Nice work.",
      "Try finding the unit rate first.");
  });

  /* 28. Ratio & rate — inverse (workers/time) */
  GENERATORS.push(function () {
    const { P1, H1, P2 } = retry(function () {
      const P1 = rnd(2, 5), H1 = rnd(4, 12);
      const total = P1 * H1;
      const candidates = [];
      for (let p = 2; p <= 8; p++) if (p !== P1 && total % p === 0) candidates.push(p);
      if (!candidates.length) return null;
      return { P1, H1, P2: choice(candidates) };
    });
    const total = P1 * H1, correct = total / P2;
    const wrongDirect = H1 * P2 / P1;
    const distractors = uniq3(correct, [() => Number.isInteger(wrongDirect) ? wrongDirect : Math.round(wrongDirect * 10) / 10, () => total, () => H1]);
    return Q("Ratio & rate", `If ${P1} painters can paint a room in ${H1} hours, how long would ${P2} painters take working at the same rate?`,
      correct + " hours", distractors.map(d => d + " hours"),
      "More painters means less time. This one runs the opposite way to the usual proportion.",
      `The job takes <span class='expr'>${P1} × ${H1} = ${total}</span> painter-hours in total. With ${P2} painters that's <span class='expr'>${total} ÷ ${P2} = ${correct}</span> hours. Watch for this reversal: adding workers shrinks the time rather than growing it.`,
      "Caught the inverse relationship.",
      "Should more painters take more time or less?");
  });

  /* 29. Unit conversion — feet to inches */
  GENERATORS.push(function () {
    const F = rnd(2, 9), correct = F * 12;
    const distractors = uniq3(correct, [() => F * 10, () => F + 12, () => F * 12 / 2]);
    return Q("Unit conversion", `How many inches are in ${F} feet?`,
      correct, distractors,
      "There are 12 inches in a foot.",
      `<span class='expr'>${F} × 12 = ${correct}</span> inches. Going from a larger unit to a smaller one always multiplies, so the number gets bigger.`,
      "Correct.",
      "Multiply by 12 when converting feet to inches.");
  });

  /* 30. Unit conversion — mph over minutes */
  GENERATORS.push(function () {
    const S = choice([30, 40, 45, 50, 60, 72, 80, 90]);
    const M = choice([10, 12, 15, 20, 24, 30, 40, 45]);
    const correct = S * M / 60;
    const distractors = uniq3(correct, [() => S * M, () => Math.round(S / M * 10) / 10, () => S * M / 100]);
    return Q("Unit conversion", `A car travels at ${S} miles per hour. How far does it travel in ${M} minutes?`,
      correct + " miles", distractors.map(d => d + " miles"),
      `${M} minutes is a fraction of an hour. The rate is given per hour.`,
      `${M} minutes is <span class='expr'>${M}/60</span> of an hour, so the car covers <span class='expr'>${S} × ${M}/60 = ${correct}</span> miles. Multiplying ${S} by ${M} without converting the minutes gives ${S * M}, and dividing carelessly gives the wrong quotient.`,
      "Units matched.",
      "Convert the minutes to a fraction of an hour first.");
  });

  /* 31. Prealgebra — distribute and simplify */
  GENERATORS.push(function () {
    const k = rnd(2, 6), m = rnd(1, 9), n = rnd(1, k - 1);
    const xTerm = coef => coef === 1 ? "x" : `${coef}x`;
    const correct = `${xTerm(k - n)} + ${k * m}`;
    const d1 = `${xTerm(k - n)} + ${m}`;
    const d2 = `${xTerm(k + n)} + ${k * m}`;
    const d3 = `${xTerm(k)} + ${k * m}`;
    const distractors = uniq3(correct, [() => d1, () => d2, () => d3]);
    return Q("Prealgebra", `Simplify: <span class='expr'>${k}(x + ${m}) − ${n}x</span>`,
      correct, distractors,
      `Distribute the ${k} across both terms, then combine like terms.`,
      `Distributing gives <span class='expr'>${k}x + ${k * m} − ${n}x</span>. Combining the x terms: <span class='expr'>${k}x − ${n}x = ${k - n}x</span>, leaving <span class='expr'>${correct}</span>.`,
      "Cleanly simplified.",
      `The ${k} multiplies both the x and the ${m}.`);
  });

  /* 32. Prealgebra — evaluate with negative substitution */
  GENERATORS.push(function () {
    const p = choice([2, 3]), q = choice([2, 3, 4]);
    const a = -rnd(2, 6), b = rnd(2, 9);
    const correct = p * a * a - q * b;
    const signKept = -p * a * a - q * b;
    const addedB = p * a * a + q * b;
    const noSquare = p * a - q * b;
    const distractors = uniq3(correct, [() => signKept, () => addedB, () => noSquare]);
    return Q("Prealgebra", `Evaluate <span class='expr'>${p}a² − ${q}b</span> when <span class='expr'>a = ${a}</span> and <span class='expr'>b = ${b}</span>.`,
      correct, distractors,
      `Square the ${a} before multiplying by ${p}. The square makes it positive.`,
      `<span class='expr'>a² = (${a})² = ${a * a}</span>, so <span class='expr'>${p}a² = ${p * a * a}</span>. Then <span class='expr'>${q}b = ${q * b}</span>, and <span class='expr'>${p * a * a} − ${q * b} = ${correct}</span>. Squaring before multiplying is what keeps this positive.`,
      "Substituted carefully.",
      "Apply the exponent before the multiplication.");
  });

  /* 33. Linear equations — one step further */
  GENERATORS.push(function () {
    const a = rnd(2, 9), xTrue = rnd(2, 15), b = rnd(1, 20);
    const c = a * xTrue - b;
    const wrong1 = Math.round(((c - b) / a) * 100) / 100;
    const wrong2 = Math.round((c / a) * 100) / 100;
    const wrong3 = (c + b) * a;
    const distractors = uniq3(xTrue, [() => wrong1, () => wrong2, () => wrong3]);
    return Q("Linear equations", `Solve for x: <span class='expr'>${a}x − ${b} = ${c}</span>`,
      "x = " + xTrue, distractors.map(d => "x = " + d),
      "Undo the subtraction before you undo the multiplication.",
      `Add ${b} to both sides for <span class='expr'>${a}x = ${a * xTrue}</span>, then divide by ${a} to get <span class='expr'>x = ${xTrue}</span>. Check: <span class='expr'>${a}(${xTrue}) − ${b} = ${c}</span>. ✓`,
      "That checks out.",
      "Watch the order you undo the operations.");
  });

  /* 34. Linear equations — variable on both sides */
  GENERATORS.push(function () {
    const a = rnd(4, 9), c = rnd(1, a - 1), xTrue = rnd(2, 12), b = rnd(1, 15);
    const d = (a - c) * xTrue - b;
    const wrong1 = Math.round(((b + d) / (a - c)) * 100) / 100;
    const wrong2 = Math.round(((d - b) / (a + c)) * 100) / 100;
    const wrong3 = xTrue + c;
    const distractors = uniq3(xTrue, [() => wrong1, () => wrong2, () => wrong3]);
    return Q("Linear equations", `Solve for x: <span class='expr'>${a}x − ${b} = ${c}x + ${d}</span>`,
      "x = " + xTrue, distractors.map(dd => "x = " + dd),
      "Get all the x terms onto one side first.",
      `Subtract <span class='expr'>${c}x</span> from both sides: <span class='expr'>${a - c}x − ${b} = ${d}</span>. Add ${b}: <span class='expr'>${a - c}x = ${(a - c) * xTrue}</span>, so <span class='expr'>x = ${xTrue}</span>. Check: <span class='expr'>${a}(${xTrue}) − ${b} = ${a * xTrue - b}</span> and <span class='expr'>${c}(${xTrue}) + ${d} = ${c * xTrue + d}</span>. ✓`,
      "Both sides balanced.",
      "Collect the x terms on one side before solving.");
  });

  /* 35. Inequalities — one step */
  GENERATORS.push(function () {
    const a = rnd(2, 12), b = rnd(a + 3, a + 20);
    const correct = b - a;
    const distractors = uniq3(correct, [() => b + a, () => -(b - a), () => b * a]);
    return Q("Inequalities", `Solve: <span class='expr'>x + ${a} > ${b}</span>`,
      "x > " + correct, distractors.map(d => "x > " + d),
      `Solve it exactly like an equation — subtract ${a} from both sides.`,
      `Subtracting ${a} from both sides gives <span class='expr'>x > ${correct}</span>. Adding and subtracting work the same as with an equals sign; the inequality symbol doesn't change.`,
      "Correct.",
      `Subtract ${a} from both sides, as you would with an equation.`);
  });

  /* 36. Inequalities — divide by a negative (flip) */
  GENERATORS.push(function () {
    const k = rnd(2, 6), r = rnd(2, 12), m = k * r;
    const correct = "x < −" + r;
    const noFlip = "x > −" + r;
    const wrongSign = "x < " + r;
    const wrongSignNoFlip = "x > " + r;
    return Q("Inequalities", `Solve: <span class='expr'>−${k}x > ${m}</span>`,
      correct, [noFlip, wrongSign, wrongSignNoFlip],
      "When you divide both sides by a negative number, the inequality symbol flips direction.",
      `Divide both sides by −${k} to get <span class='expr'>x < −${r}</span> — the symbol flips because you divided by a negative. Test it: <span class='expr'>x = −${r + 1}</span> gives <span class='expr'>−${k}(−${r + 1}) = ${k * (r + 1)}</span>, which is greater than ${m}. ✓`,
      "You flipped the sign.",
      "Dividing by a negative flips the inequality.");
  });

  /* 37. Quadratics — difference of squares */
  GENERATORS.push(function () {
    const n = rnd(2, 12);
    const correct = `x = ${n} and x = −${n}`;
    const d1 = `x = ${n} only`;
    const d2 = `x = ${n * n} and x = −${n * n}`;
    const d3 = "There are no solutions";
    return Q("Quadratics", `What are the solutions to <span class='expr'>x² − ${n * n} = 0</span>?`,
      correct, [d1, d2, d3],
      `What numbers, when squared, give ${n * n}?`,
      `<span class='expr'>x² = ${n * n}</span>, and both <span class='expr'>${n}² = ${n * n}</span> and <span class='expr'>(−${n})² = ${n * n}</span>. A quadratic like this has two solutions, so leaving off the negative loses half the answer.`,
      "Both roots found.",
      "Don't forget the negative root.");
  });

  /* 38. Quadratics — factorable trinomial */
  GENERATORS.push(function () {
    let r1, r2;
    do { r1 = rnd(-9, 9); r2 = rnd(-9, 9); } while (r1 === r2 || r1 === 0 || r2 === 0);
    const b = -(r1 + r2), c = r1 * r2;
    const bStr = b === 0 ? "" : (b > 0 ? ` + ${b}x` : ` − ${-b}x`);
    const cStr = c >= 0 ? ` + ${c}` : ` − ${-c}`;
    const fmt = (x, y) => `x = ${x} and x = ${y}`;
    const correct = fmt(r1, r2);
    const seen = new Set([[r1, r2].sort().join(",")]);
    const cands = [[-r1, -r2], [-r1, r2], [r1, -r2], [r2, r1]];
    const distractors = [];
    for (const [x, y] of cands) {
      const key = [x, y].sort().join(",");
      if (!seen.has(key)) { seen.add(key); distractors.push(fmt(x, y)); }
      if (distractors.length === 3) break;
    }
    while (distractors.length < 3) distractors.push(fmt(r1 + distractors.length, r2 - distractors.length));
    return Q("Quadratics", `What are the solutions to <span class='expr'>x²${bStr}${cStr} = 0</span>?`,
      correct, distractors,
      `Find two numbers that multiply to ${c} and add to ${b}.`,
      `<span class='expr'>${-r1} × ${-r2} = ${c}</span> and <span class='expr'>${-r1} + ${-r2} = ${b}</span>, so it factors as <span class='expr'>(x ${r1 >= 0 ? "− " + r1 : "+ " + -r1})(x ${r2 >= 0 ? "− " + r2 : "+ " + -r2}) = 0</span>, giving <span class='expr'>x = ${r1}</span> and <span class='expr'>x = ${r2}</span>. Note the signs flip from the factors to the solutions.`,
      "Factored cleanly.",
      "Check the signs — the factors and the solutions have opposite ones.");
  });

  /* 39. Growth — one year */
  GENERATORS.push(function () {
    const P0 = rnd(10, 50) * 100, r = choice([4, 5, 8, 10, 12, 15, 20]);
    const inc = P0 * r / 100, correct = P0 + inc;
    const distractors = uniq3(correct, [() => inc, () => P0 - inc, () => P0 * r]);
    return Q("Growth", `A town's population is ${nf(P0)} and grows by ${r}% in one year. What is the population after that year?`,
      nf(correct), distractors.map(nf),
      `Find ${r}% of ${nf(P0)}, then add it on. Or multiply by ${1 + r / 100} in one step.`,
      `${r}% of ${nf(P0)} is ${nf(inc)}, so the population becomes <span class='expr'>${nf(P0)} + ${nf(inc)} = ${nf(correct)}</span>. In one step: <span class='expr'>${nf(P0)} × ${1 + r / 100} = ${nf(correct)}</span>.`,
      "Correct.",
      `${r}% of ${nf(P0)} is ${nf(inc)}, not ${r}.`);
  });

  /* 40. Growth — two years compounding */
  GENERATORS.push(function () {
    const P0 = choice([800, 1200, 1600, 2000, 2400, 2800, 3200, 3600, 4000]);
    const r = 5;
    const y1 = P0 * 1.05, y2 = y1 * 1.05;
    const linearGuess = P0 + 2 * (P0 * r / 100);
    const distractors = uniq3(Math.round(y2), [() => Math.round(y1), () => linearGuess, () => Math.round(y2) + 6]);
    return Q("Growth", `That same town of ${nf(P0)} people grows by ${r}% every year. What is the population after 2 years?`,
      nf(Math.round(y2)), distractors.map(nf),
      "The second year's 5% is calculated on the new, larger population.",
      `Year 1: <span class='expr'>${nf(P0)} × 1.05 = ${nf(y1)}</span>. Year 2: <span class='expr'>${nf(y1)} × 1.05 = ${nf(Math.round(y2))}</span>. Growth compounds, so it beats the ${nf(linearGuess)} you'd get by adding 5% of the original twice.`,
      "Compounding handled.",
      `The second year grows from ${nf(y1)}, not from ${nf(P0)}.`);
  });

  /* 41. Geometry vocabulary — perpendicular (concept, no numbers) */
  GENERATORS.push(function () {
    return Q("Geometry vocabulary", "Two lines that cross at a right angle are called:",
      "Perpendicular", ["Parallel", "Congruent", "Similar"],
      "Think of the corner of a square, or a plus sign.",
      "Perpendicular lines meet at 90°. Parallel lines never meet at all. Congruent means identical in size and shape, and similar means same shape at a different size — both describe figures, not the angle between lines.",
      "Right term.",
      "Parallel lines never cross at all.");
  });

  /* 42. Geometry vocabulary — trapezoid (concept, no numbers) */
  GENERATORS.push(function () {
    return Q("Geometry vocabulary", "A quadrilateral with exactly one pair of parallel sides is called a:",
      "Trapezoid", ["Rhombus", "Parallelogram", "Rectangle"],
      "The other three shapes listed all have two pairs of parallel sides.",
      "A trapezoid has exactly one pair of parallel sides. A parallelogram, rhombus, and rectangle each have two pairs, which is what separates them from a trapezoid.",
      "Correct shape.",
      "Count how many pairs of parallel sides each shape has.");
  });

  /* 43. Angles — complementary */
  GENERATORS.push(function () {
    const a = rnd(1, 89), correct = 90 - a;
    const distractors = uniq3(correct, [() => 180 - a, () => a, () => a + 90]);
    return Q("Angles", `Two angles are complementary. One measures ${a}°. What does the other measure?`,
      correct + "°", distractors.map(d => d + "°"),
      "Complementary angles add to 90°. Supplementary angles add to 180° — don't mix them up.",
      `<span class='expr'>90 − ${a} = ${correct}</span>°. If they had been supplementary, adding to 180°, the answer would be ${180 - a}°, which is why the two words are worth keeping straight.`,
      "Right pair.",
      "Complementary means adding to 90°, not 180°.");
  });

  /* 44. Angles — supplementary ratio */
  GENERATORS.push(function () {
    const k = choice([2, 3, 4, 5, 8, 9]);
    const x = 180 / (k + 1), larger = 180 - x;
    const distractors = uniq3(x, [() => larger, () => 90, () => x * 2]);
    return Q("Angles", `Two angles are supplementary, and one is ${k} times the size of the other. What is the smaller angle?`,
      x + "°", distractors.map(d => d + "°"),
      `Call the smaller angle x. Then the larger is ${k}x, and together they make 180°.`,
      `<span class='expr'>x + ${k}x = 180</span>, so <span class='expr'>${k + 1}x = 180</span> and <span class='expr'>x = ${x}</span>°. The larger angle is ${larger}°, and the two do add to 180°. ✓`,
      "Set it up well.",
      "Write both angles in terms of one variable first.");
  });

  /* 45. Perimeter & area — square area to perimeter */
  GENERATORS.push(function () {
    const s = rnd(4, 15), A = s * s, correct = 4 * s;
    const distractors = uniq3(correct, [() => A, () => 2 * s, () => s]);
    return Q("Perimeter & area", `A square has an area of ${A} square inches. What is its perimeter?`,
      correct + " inches", distractors.map(d => d + " inches"),
      "Find the side length first — what number times itself is " + A + "?",
      `Since <span class='expr'>${s} × ${s} = ${A}</span>, each side is ${s} inches, and the perimeter is <span class='expr'>4 × ${s} = ${correct}</span> inches.`,
      "Nailed it.",
      "Find the side length before the perimeter.");
  });

  /* 46. Perimeter & area — rectangle perimeter to area */
  GENERATORS.push(function () {
    const L = rnd(6, 20), w = rnd(2, 15), Peri = 2 * L + 2 * w, correct = L * w;
    const distractors = uniq3(correct, [() => L * Peri, () => Peri - L, () => w * w]);
    return Q("Perimeter & area", `A rectangle has a length of ${L} cm and a perimeter of ${Peri} cm. What is its area?`,
      correct + " cm²", distractors.map(d => d + " cm²"),
      "Use the perimeter to find the missing width first.",
      `<span class='expr'>P = 2l + 2w</span>, so <span class='expr'>${Peri} = ${2 * L} + 2w</span> and the width is ${w} cm. Area is <span class='expr'>${L} × ${w} = ${correct}</span> cm².`,
      "Well reasoned.",
      "Solve for the width using the perimeter formula.");
  });

  /* 47. Circles — circumference from diameter */
  GENERATORS.push(function () {
    const d = choice([5, 10, 15, 20, 25, 30]);
    const correct = Math.round(3.14 * d * 10) / 10;
    const distractors = uniq3(correct, [() => Math.round(3.14 * d / 2 * 10) / 10, () => Math.round(3.14 * (d / 2) * (d / 2) * 10) / 10, () => d * 3]);
    return Q("Circles", `A circle has a diameter of ${d} cm. What is its circumference? (Use <span class='expr'>π ≈ 3.14</span>)`,
      correct + " cm", distractors.map(x => x + " cm"),
      "Circumference is <span class='expr'>π × diameter</span>. You're given the diameter already.",
      `<span class='expr'>C = πd = 3.14 × ${d} = ${correct}</span> cm. Using the radius by mistake, or the area formula, gives a different wrong answer.`,
      "Correct formula.",
      "Circumference uses the diameter; area uses the radius squared.");
  });

  /* 48. Circles — area in terms of pi */
  GENERATORS.push(function () {
    const d = rnd(4, 15) * 2, r = d / 2;
    const correct = `${r * r}π`;
    const distractors = uniq3(correct, [() => `${d * d}π`, () => `${r * 2}π`, () => `${r}π`]);
    return Q("Circles", `A circle has a diameter of ${d} inches. What is its area, in terms of π?`,
      correct, distractors,
      "The area formula needs the radius, but you've been handed the diameter. Halve it first.",
      `The radius is <span class='expr'>${d} ÷ 2 = ${r}</span>. Then <span class='expr'>A = πr² = π(${r}²) = ${r * r}π</span> square inches. Squaring the diameter instead gives ${d * d}π, the usual slip.`,
      "Halved before squaring.",
      "Convert diameter to radius before squaring.");
  });

  /* 49. Volume — rectangular box */
  GENERATORS.push(function () {
    const l = rnd(3, 9), w = rnd(3, 9), h = rnd(3, 9), correct = l * w * h;
    const sa = 2 * (l * w + l * h + w * h);
    const distractors = uniq3(correct, [() => sa, () => l + w + h, () => correct * 2]);
    return Q("Volume & surface area", `What is the volume of a rectangular box measuring ${l} cm by ${w} cm by ${h} cm?`,
      correct + " cm³", distractors.map(x => x + " cm³"),
      "Volume of a box is length times width times height.",
      `<span class='expr'>${l} × ${w} × ${h} = ${correct}</span> cm³. The answer ${sa} is the surface area of the same box, which is a different question.`,
      "Correct.",
      "Multiply all three dimensions together.");
  });

  /* 50. Surface area — cube */
  GENERATORS.push(function () {
    const e = rnd(3, 9), face = e * e, correct = 6 * face, vol = e * e * e;
    const distractors = uniq3(correct, [() => vol, () => 4 * face, () => face]);
    return Q("Volume & surface area", `What is the total surface area of a cube with edges of ${e} inches?`,
      correct + " in²", distractors.map(x => x + " in²"),
      "A cube has 6 identical square faces. Find the area of one, then account for all of them.",
      `Each face is <span class='expr'>${e} × ${e} = ${face}</span> in², and a cube has 6 faces, so <span class='expr'>6 × ${face} = ${correct}</span> in². The answer ${vol} is the cube's volume, not its surface area.`,
      "All six faces counted.",
      "Find one face's area, then multiply by 6.");
  });

  /* 51. Congruent triangles — concept (no numbers) */
  GENERATORS.push(function () {
    return Q("Congruent triangles", "Two triangles are congruent. What does that tell you about them?",
      "Same shape and same size",
      ["Same shape, but different sizes", "They have the same perimeter but may differ in shape", "They are both right triangles"],
      "Congruent and similar are different words. One allows resizing, the other doesn't.",
      "Congruent figures are identical: matching side lengths and matching angles. Similar figures have the same shape at a different scale. Congruent triangles are always similar, but similar triangles are only congruent when the scale factor is 1.",
      "Vocabulary nailed.",
      "That describes similar triangles, not congruent ones.");
  });

  /* 52. Congruent triangles — corresponding parts */
  GENERATORS.push(function () {
    const len = rnd(4, 15);
    let deg;
    do { deg = rnd(20, 80); } while (deg === 45);
    const correct = `DE = ${len} cm and angle D = ${deg}°`;
    const d1 = `DE = ${len * 2} cm and angle D = ${deg}°`;
    const d2 = `DE = ${len} cm and angle D = ${90 - deg}°`;
    const d3 = "There isn't enough information";
    return Q("Congruent triangles", `Triangle ABC is congruent to triangle DEF. Side AB measures ${len} cm, and angle A measures ${deg}°. What can you conclude?`,
      correct, [d1, d2, d3],
      "The letter order tells you which parts match up: A pairs with D, B with E, C with F.",
      "In congruent triangles, corresponding parts are equal. The naming order pairs A with D and B with E, so AB corresponds to DE and measures the same length, and angle D matches angle A.",
      "Corresponding parts matched.",
      "Congruent means the matching parts are equal, not scaled.");
  });

  /* 53. Similar triangles — scale factor */
  GENERATORS.push(function () {
    const ratio = choice([[4, 6, 8], [3, 5, 7], [2, 3, 4], [5, 8, 11], [6, 9, 12]]);
    const k = choice([2, 3, 4]);
    const ns = ratio[0] * k, correct = ratio[2] * k;
    const distractors = uniq3(correct, [() => ratio[1] * k, () => ratio[2] + (ns - ratio[0]), () => correct + k]);
    return Q("Similar triangles", `Triangle A has sides ${ratio[0]}, ${ratio[1]}, and ${ratio[2]}. Triangle B is similar to Triangle A, and its shortest side is ${ns}. What is Triangle B's longest side?`,
      correct, distractors,
      "Find the scale factor from the shortest sides, then apply it to the longest.",
      `The scale factor is <span class='expr'>${ns} ÷ ${ratio[0]} = ${k}</span>. Triangle A's longest side is ${ratio[2]}, so Triangle B's longest is <span class='expr'>${ratio[2]} × ${k} = ${correct}</span>.`,
      "Scaled correctly.",
      "Match corresponding sides before scaling.");
  });

  /* 54. Similar triangles — shadow problem */
  GENERATORS.push(function () {
    const ph = rnd(4, 7), psh = rnd(2, 6), m = rnd(3, 8), tsh = psh * m, correct = ph * m;
    const distractors = uniq3(correct, [() => tsh - psh + ph, () => ph * tsh, () => Math.round(tsh * psh / ph)]);
    return Q("Similar triangles", `A ${ph}-foot-tall person casts a ${psh}-foot shadow. At the same time, a nearby tree casts a ${tsh}-foot shadow. How tall is the tree?`,
      correct + " feet", distractors.map(d => d + " feet"),
      "The person and the tree form similar triangles with their shadows. Set up matching ratios.",
      `Height over shadow is the same for both: <span class='expr'>${ph}/${psh} = h/${tsh}</span>. Cross-multiplying gives <span class='expr'>${psh}h = ${ph * tsh}</span>, so <span class='expr'>h = ${correct}</span> feet. The trap is subtracting or adding instead of scaling.`,
      "Set the proportion up right.",
      "Keep height over shadow on both sides of the proportion.");
  });

  /* 55. Right triangles — ladder */
  GENERATORS.push(function () {
    const triples = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15], [20, 21, 29], [12, 16, 20]];
    const [leg1, leg2, hyp] = choice(triples);
    const distractors = uniq3(leg2, [() => hyp - leg1, () => leg1, () => hyp]);
    return Q("Right triangles", `A ${hyp}-foot ladder leans against a wall with its base ${leg1} feet from the wall. How high up the wall does the ladder reach?`,
      leg2 + " feet", distractors.map(d => d + " feet"),
      "The ladder is the hypotenuse, not a leg.",
      `By the Pythagorean theorem, <span class='expr'>${leg1}² + h² = ${hyp}²</span>, so <span class='expr'>h² = ${hyp * hyp - leg1 * leg1}</span> and <span class='expr'>h = ${leg2}</span> feet.`,
      "Textbook.",
      `The ${hyp} is the longest side, so it's the hypotenuse.`);
  });

  /* 56. Right triangles — hypotenuse and leg to area */
  GENERATORS.push(function () {
    const triples = [[6, 8, 10], [9, 12, 15], [12, 16, 20], [15, 20, 25], [5, 12, 13], [8, 15, 17]];
    const [legA, legB, hyp] = choice(triples);
    const correct = 0.5 * legA * legB;
    const distractors = uniq3(correct, [() => 0.5 * hyp * legA, () => legA * legB, () => hyp * legB]);
    return Q("Right triangles", `A right triangle has a hypotenuse of ${hyp} and one leg of ${legA}. What is its area?`,
      correct, distractors,
      "You need both legs before you can find the area. Find the missing one first.",
      `The missing leg: <span class='expr'>${legA}² + b² = ${hyp}²</span> gives <span class='expr'>b² = ${legB * legB}</span> and <span class='expr'>b = ${legB}</span>. Area of a triangle is <span class='expr'>½ × ${legA} × ${legB} = ${correct}</span>. Using the hypotenuse as a base gives a different, wrong number.`,
      "Two steps, both right.",
      "The two legs form the right angle — the hypotenuse isn't one of them.");
  });

  /* 57. Coordinate plane — quadrant */
  GENERATORS.push(function () {
    const x = rnd(1, 9) * choice([1, -1]), y = rnd(1, 9) * choice([1, -1]);
    let correct;
    if (x > 0 && y > 0) correct = "Quadrant I";
    else if (x < 0 && y > 0) correct = "Quadrant II";
    else if (x < 0 && y < 0) correct = "Quadrant III";
    else correct = "Quadrant IV";
    const all = ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"];
    const distractors = all.filter(q => q !== correct);
    return Q("Coordinate plane", `In which quadrant does the point (${x}, ${y}) lie?`,
      correct, distractors,
      "Quadrants are numbered counterclockwise starting from the top right. A negative x means left of the y-axis.",
      `A ${x < 0 ? "negative" : "positive"} x puts the point ${x < 0 ? "left" : "right"} of center, and a ${y < 0 ? "negative" : "positive"} y puts it ${y < 0 ? "below" : "above"} center, which is ${correct}.`,
      "Correct quadrant.",
      "Check the sign of x for left/right and the sign of y for up/down.");
  });

  /* 58. Coordinate plane — distance on an axis-aligned segment */
  GENERATORS.push(function () {
    const vertical = choice([true, false]);
    const shared = rnd(-8, 8);
    const p1 = rnd(-9, 5), p2 = p1 + rnd(3, 12);
    const correct = p2 - p1;
    const distractors = uniq3(correct, [() => p1 + p2, () => Math.round(correct / 2), () => correct + shared]);
    const pt1 = vertical ? `(${shared}, ${p1})` : `(${p1}, ${shared})`;
    const pt2 = vertical ? `(${shared}, ${p2})` : `(${p2}, ${shared})`;
    return Q("Coordinate plane", `What is the distance between the points ${pt1} and ${pt2}?`,
      correct, distractors,
      `Both points share the same ${vertical ? "x" : "y"} value, so this is a straight ${vertical ? "vertical" : "horizontal"} line. No formula needed.`,
      `Since the ${vertical ? "x" : "y"} values match, the points sit on a ${vertical ? "vertical" : "horizontal"} line and the distance is just the gap: <span class='expr'>${p2} − ${p1} = ${correct}</span>. Adding the coordinates instead gives ${p1 + p2}.`,
      "Spotted the shortcut.",
      `Same ${vertical ? "x" : "y"} means a straight line — just subtract the other coordinate.`);
  });

  /* 59. Coordinate geometry — slope */
  GENERATORS.push(function () {
    const m = choice([-3, -2, -1, 1, 2, 3, 4]);
    const x1 = rnd(-5, 5), run = rnd(2, 6), x2 = x1 + run;
    const y1 = rnd(-10, 10), y2 = y1 + m * run;
    const distractors = uniq3(m, [() => fracStr(run, m * run), () => -m, () => y2 - y1]);
    return Q("Coordinate geometry", `What is the slope of the line through the points (${x1}, ${y1}) and (${x2}, ${y2})?`,
      m, distractors,
      "Slope is rise over run: the change in y divided by the change in x.",
      `<span class='expr'>(${y2} − ${y1}) ÷ (${x2} − ${x1}) = ${y2 - y1} ÷ ${run} = ${m}</span>. Flipping the fraction gives a common slip.`,
      "Rise over run.",
      "Divide the change in y by the change in x, in that order.");
  });

  /* 60. Coordinate geometry — equation of a line */
  GENERATORS.push(function () {
    const m = choice([-3, -2, -1, 1, 2, 3, 4]);
    const x1 = rnd(-6, 6), run = rnd(2, 6), x2 = x1 + run;
    const y1 = rnd(-10, 10), y2 = y1 + m * run;
    const b = y1 - m * x1;
    const mTerm = m === 1 ? "x" : (m === -1 ? "−x" : `${m}x`);
    const bTerm = b === 0 ? "" : (b > 0 ? ` + ${b}` : ` − ${-b}`);
    const correct = `y = ${mTerm}${bTerm}`;
    const wrongB = b + run;
    const wrongBTerm = wrongB === 0 ? "" : (wrongB > 0 ? ` + ${wrongB}` : ` − ${-wrongB}`);
    const d1 = `y = ${mTerm}${wrongBTerm}`;
    const invM = fracStr(1, m === 0 ? 1 : m);
    const d2 = `y = ${invM}x${bTerm}`;
    const altSlope = m + 1;
    const altTerm = altSlope === 1 ? "x" : (altSlope === -1 ? "−x" : `${altSlope}x`);
    const d3 = `y = ${altTerm}${bTerm}`;
    const distractors = uniq3(correct, [() => d1, () => d2, () => d3]);
    return Q("Coordinate geometry", `What is the equation of the line passing through the points (${x1}, ${y1}) and (${x2}, ${y2})?`,
      correct, distractors,
      "Find the slope, then substitute one point to solve for the y-intercept.",
      `Slope = <span class='expr'>(${y2} − ${y1}) ÷ (${x2} − ${x1}) = ${y2 - y1} ÷ ${run} = ${m}</span>. Substituting (${x2}, ${y2}) into <span class='expr'>y = ${mTerm}${bTerm ? " " + bTerm.trim() : " + b"}</span> and solving gives <span class='expr'>b = ${b}</span>, so <span class='expr'>${correct}</span>.`,
      "Solid.",
      "The slope may match in more than one option — check the intercept too.");
  });

  /* 61. Reading graphs — linear extrapolation */
  GENERATORS.push(function () {
    const rate = rnd(2, 6), y1 = rnd(0, 10), x2 = rnd(3, 6), y2 = y1 + rate * x2;
    const extra = rnd(2, 5), x3 = x2 + extra, correct = y2 + rate * extra;
    const distractors = uniq3(correct, [() => y2 + extra, () => Math.round(y2 * x3 / x2), () => y2 + rate * extra + rate]);
    return Q("Reading graphs", `A line on a graph passes through (0, ${y1}) and (${x2}, ${y2}). Following the same trend, what value of y would you expect at x = ${x3}?`,
      correct, distractors,
      "Work out how much y climbs for each single step in x, then extend it.",
      `y rises ${y2 - y1} while x rises ${x2}, a rate of ${rate} per unit. From x = ${x2} to x = ${x3} is ${extra} more units, so y climbs another ${rate * extra}: <span class='expr'>${y2} + ${rate * extra} = ${correct}</span>.`,
      "Read the trend correctly.",
      "Find the rate of change between the given points first.");
  });

  /* 62. Reading graphs — flat line concept */
  GENERATORS.push(function () {
    const h = rnd(1, 8);
    return Q("Reading graphs", `A graph plots a car's total distance travelled against time. Between hour ${h} and hour ${h + 1}, the line is completely flat. What does that mean?`,
      "The car was stopped",
      ["The car sped up", "The car drove backwards", "The car kept a steady speed"],
      "On a distance-time graph, the steepness of the line is the speed.",
      "A flat line means the total distance didn't change during that hour, so the car covered no ground: it was stopped. A steady speed would show as a straight line sloping upward, not a flat one.",
      "Read the shape, not just the numbers.",
      "Ask what a flat line says about the distance changing.");
  });

  /* 63. Median & mode — mode */
  GENERATORS.push(function () {
    const modeVal = rnd(2, 9);
    const others = [];
    while (others.length < 4) {
      const v = rnd(1, 12);
      if (v !== modeVal) others.push(v);
    }
    const set = shuffle([modeVal, modeVal, modeVal].concat(others));
    const mean = Math.round((set.reduce((a, b) => a + b, 0) / set.length) * 10) / 10;
    const distractors = uniq3(modeVal, [() => others[0], () => others[1], () => mean]);
    return Q("Median & mode", `What is the mode of this set? ${set.join(", ")}`,
      modeVal, distractors,
      "The mode is the value that shows up most often. Just count.",
      `${modeVal} appears three times; every other value appears once. The mode is ${modeVal}. Note that ${mean} is roughly the mean, which is a different measure entirely.`,
      "Correct.",
      "The mode is about frequency, not size or average.");
  });

  /* 64. Median & mode — median of an even-count set */
  GENERATORS.push(function () {
    const vals = shuffle(Array.from({ length: 30 }, (_, i) => i + 1)).slice(0, 4).sort((a, b) => a - b);
    const correct = (vals[1] + vals[2]) / 2;
    const distractors = uniq3(correct, [() => vals[1], () => vals[1] + vals[2], () => vals[3] - vals[0]]);
    return Q("Median & mode", `What is the median of this set? ${vals.join(", ")}`,
      correct, distractors,
      "With an even count there's no single middle value. Average the two in the middle.",
      `Ordered, the two middle values are ${vals[1]} and ${vals[2]}. Their average is <span class='expr'>(${vals[1]} + ${vals[2]}) ÷ 2 = ${correct}</span>. With an odd count you'd just pick the middle number, but an even count needs this extra step.`,
      "Even count handled.",
      "With an even count, average the two middle values.");
  });

  /* 65. Data & statistics — mean */
  GENERATORS.push(function () {
    const { scores, last, target, partial } = retry(function () {
      const scores = Array.from({ length: 4 }, () => rnd(60, 98));
      const partial = scores.reduce((a, b) => a + b, 0);
      const target = rnd(65, 95);
      const last = target * 5 - partial;
      if (last < 0 || last > 100) return null;
      return { scores, last, target, partial };
    });
    const all = scores.concat([last]).sort((a, b) => a - b);
    const median = all[2];
    const distractors = uniq3(target, [() => median, () => Math.round(partial / 4), () => target + 2]);
    return Q("Data & statistics", `A student's five test scores are ${scores[0]}, ${scores[1]}, ${scores[2]}, ${scores[3]}, and ${last}. What is the mean score?`,
      target, distractors,
      "Add all five, then divide by 5.",
      `The scores total ${partial + last}, and <span class='expr'>${partial + last} ÷ 5 = ${target}</span>.`,
      "Right on the money.",
      "That's a different measure of center.");
  });

  /* 66. Data & statistics — score needed for target average */
  GENERATORS.push(function () {
    const n = 4, avgSoFar = rnd(70, 88), target = avgSoFar + rnd(2, 6);
    const totalSoFar = avgSoFar * n, neededTotal = target * (n + 1), correct = neededTotal - totalSoFar;
    const distractors = uniq3(correct, [() => target, () => target + (target - avgSoFar), () => correct - 3]);
    return Q("Data & statistics", `A student has averaged ${avgSoFar} across four tests. What score is needed on the fifth test to bring the average up to ${target}?`,
      correct, distractors,
      "Work with totals rather than averages: what must all five scores add up to?",
      `Four tests at an ${avgSoFar} average total <span class='expr'>4 × ${avgSoFar} = ${totalSoFar}</span>. Five tests averaging ${target} must total <span class='expr'>5 × ${target} = ${neededTotal}</span>. The difference is <span class='expr'>${neededTotal} − ${totalSoFar} = ${correct}</span>. Pulling an average up takes more than the target itself.`,
      "Totals beat averages here.",
      "Convert both averages into totals first.");
  });

  /* 67. Probability — not a given color */
  GENERATORS.push(function () {
    const red = rnd(2, 9), blue = rnd(2, 9), green = rnd(2, 9);
    const total = red + blue + green, notBlue = red + green;
    const correct = fracStr(notBlue, total);
    const isBlue = fracStr(blue, total);
    const redOnly = fracStr(red, total);
    const wrongReduce = `${notBlue}/${total}`;
    const distractors = uniq3(correct, [() => isBlue, () => redOnly, () => fracStr(total - notBlue - 1, total)]);
    return Q("Probability", `A bag holds ${red} red marbles, ${blue} blue marbles, and ${green} green marbles. If one marble is drawn at random, what is the probability that it is NOT blue?`,
      correct, distractors,
      "How many marbles are there in total, and how many of them are not blue?",
      `There are ${total} marbles in all, and <span class='expr'>${red} + ${green} = ${notBlue}</span> are not blue, giving <span class='expr'>${correct}</span>. You could also compute <span class='expr'>1 − ${isBlue}</span>.`,
      "You've got it.",
      "Count the total marbles again.");
  });

  /* 68. Probability — two draws without replacement */
  GENERATORS.push(function () {
    const red = rnd(3, 7), blue = rnd(2, 8), green = rnd(2, 6);
    const total = red + blue + green;
    const correctFrac = fracReduce(red * (red - 1), total * (total - 1));
    const correct = fracStr(red * (red - 1), total * (total - 1));
    const withReplacement = fracStr(red * red, total * total);
    const forgotSecondTotal = fracStr(red * (red - 1), total * total);
    const wrongCount = fracStr(red * red, total * (total - 1));
    const distractors = uniq3(correct, [() => withReplacement, () => forgotSecondTotal, () => wrongCount]);
    return Q("Probability", `From a bag of ${red} red, ${blue} blue, and ${green} green marbles, two marbles are drawn without replacement. What is the probability that both are red?`,
      correct, distractors,
      "After the first red is drawn, both the reds and the total are one smaller.",
      `First draw: <span class='expr'>${red}/${total}</span>. Second draw: only ${red - 1} reds remain out of ${total - 1} marbles, so <span class='expr'>${red - 1}/${total - 1}</span>. Multiply: <span class='expr'>${red}/${total} × ${red - 1}/${total - 1} = ${correct}</span>. If the marble were put back, you'd get <span class='expr'>${withReplacement}</span> instead.`,
      "Adjusted for the missing marble.",
      "The second draw comes from a smaller bag.");
  });

  function normalize(q) {
    const fix = s => typeof s === "string" ? s.replace(/-(\d)/g, "−$1") : s;
    return {
      topic: q.topic, prompt: fix(q.prompt),
      options: q.options.map(fix), correct: q.correct,
      hint: fix(q.hint), why: fix(q.why), ok: fix(q.ok), no: fix(q.no)
    };
  }

  global.GENERATORS = GENERATORS.map(fn => function () { return normalize(fn()); });
})(typeof window !== "undefined" ? window : globalThis);
