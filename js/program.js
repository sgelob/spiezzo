/* SPIEZZO — training program definition, progression rules, workout generator */
(function () {
  'use strict';

  // block item: { ex: exerciseId, mode: 'reps'|'time', base: number, top: number,
  //               perSide: bool, weighted: bool }
  const WARMUP = {
    key: 'warmup',
    rounds: 1,
    restBetween: 5,
    items: [
      { ex: 'cx-march', mode: 'time', base: 60, top: 60 },
      { ex: 'cx-jumping-jacks', mode: 'time', base: 45, top: 45 },
      { ex: 'cx-arm-circles', mode: 'time', base: 30, top: 30 },
      { ex: 'cx-air-squat', mode: 'reps', base: 12, top: 12 },
      { ex: '1471', mode: 'reps', base: 6, top: 6 },          // inchworm
      { ex: '3013', mode: 'reps', base: 12, top: 12 },        // low glute bridge
      { ex: 'cx-high-knees', mode: 'time', base: 30, top: 30 },
    ],
  };

  const SESSIONS = {
    A: {
      key: 'A',
      circuit: {
        rounds: 3,
        restExercise: 20,
        restRound: 90,
        items: [
          { ex: '1760', mode: 'reps', base: 12, top: 16, weighted: true },              // goblet squat
          { ex: '0662', mode: 'reps', base: 10, top: 20 },                              // push-up
          { ex: '0381', mode: 'reps', base: 10, top: 14, perSide: true, weighted: true }, // db rear lunge
          { ex: '0405', mode: 'reps', base: 10, top: 14, weighted: true },              // db seated shoulder press
          { ex: 'cx-trx-row', mode: 'reps', base: 12, top: 18 },
          { ex: '0630', mode: 'time', base: 40, top: 60 },                              // mountain climber
        ],
      },
      finisher: {
        rounds: 2,
        restExercise: 15,
        restRound: 45,
        items: [
          { ex: 'cx-plank', mode: 'time', base: 40, top: 75 },
          { ex: '0271', mode: 'reps', base: 15, top: 25 },                              // ball crunch
          { ex: '0276', mode: 'reps', base: 10, top: 16, perSide: true },               // dead bug
        ],
      },
    },
    B: {
      key: 'B',
      circuit: {
        rounds: 3,
        restExercise: 20,
        restRound: 90,
        items: [
          { ex: '0085', mode: 'reps', base: 12, top: 15, weighted: true },              // barbell RDL
          { ex: '0027', mode: 'reps', base: 12, top: 15, weighted: true },              // barbell bent over row
          { ex: '0431', mode: 'reps', base: 10, top: 14, perSide: true, weighted: true }, // db step-up
          { ex: 'cx-ball-leg-curl', mode: 'reps', base: 12, top: 18 },
          { ex: 'cx-trx-chest-press', mode: 'reps', base: 12, top: 18 },
          { ex: '1160', mode: 'reps', base: 8, top: 15 },                               // burpee
        ],
      },
      finisher: {
        rounds: 2,
        restExercise: 15,
        restRound: 45,
        items: [
          { ex: '0687', mode: 'reps', base: 20, top: 30 },                              // russian twist
          { ex: 'cx-side-plank', mode: 'time', base: 30, top: 60, perSide: true },
          { ex: 'cx-superman', mode: 'reps', base: 12, top: 18 },
        ],
      },
    },
  };

  const COOLDOWN = [
    { key: 'quad', time: 30, perSide: true },
    { key: 'ham', time: 30, perSide: true },
    { key: 'chest', time: 40 },
    { key: 'child', time: 45 },
    { key: 'fig4', time: 30, perSide: true },
  ];

  /* ---- progression ----
     For each program item, look at the last logged performance for (sessionKey, exId).
     reps: +1 rep per completed session; at `top`, if weighted → suggest +2.5 kg and reset to base.
     time: +5 s per completed session, capped at `top`. */
  function suggest(item, last, opts) {
    const deload = opts && opts.deload;
    let res;
    if (!last) {
      res = { value: item.base, weight: last && last.weight || null, bumpWeight: false };
    } else if (item.mode === 'time') {
      res = { value: Math.min(item.top, last.value + 5), weight: null, bumpWeight: false };
    } else if (last.value >= item.top) {
      if (item.weighted) {
        res = { value: item.base, weight: (last.weight || 0) + 2.5, bumpWeight: true };
      } else {
        res = { value: item.top, weight: null, bumpWeight: false };
      }
    } else {
      res = { value: last.value + 1, weight: last.weight || null, bumpWeight: false };
    }
    // comeback deload: after a long layoff, ease back in instead of piling on
    if (deload && last) {
      res.value = Math.max(item.base, Math.round(res.value * 0.85));
      if (res.weight) res.weight = Math.round(res.weight * 0.9 * 2) / 2;
      res.bumpWeight = false;
      res.deloaded = true;
    }
    return res;
  }

  // days since the most recent strength session (Infinity if none)
  function daysSinceLast(history) {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.session === 'A' || h.session === 'B' || h.session === 'C' || h.session === 'X') {
        return Math.round((Date.now() - new Date(h.date + 'T12:00:00').getTime()) / 86400000);
      }
    }
    return Infinity;
  }

  // pick a different exercise for the same movement pattern (used by the in-workout swap)
  function substitute(exId) {
    const cur = window.EXERCISES.find(function (e) { return e.id === exId; });
    if (!cur) return null;
    const cands = pool().filter(function (e) { return e.target === cur.target && e.id !== exId; });
    if (!cands.length) return null;
    return cands[Math.floor(Math.random() * cands.length)];
  }

  // turn a freshly generated "A CASO" circuit into a saveable Session C with real progression
  function makeCustom(gen) {
    const items = gen.circuit.items.map(function (it) {
      const top = it.mode === 'time' ? it.base + 20 : it.base + 4;
      return { ex: it.ex, mode: it.mode, base: it.base, top: top, perSide: it.perSide || false, weighted: it.weighted || false };
    });
    return { key: 'C', circuit: { rounds: 3, restExercise: 20, restRound: 90, items: items }, finisher: null };
  }

  /* ---- "A CASO" generator ----
     6 slots for a balanced metabolic circuit. Classified by target muscle. */
  const SLOTS = [
    { key: 'quad', targets: ['quads'], mode: 'reps', base: 12 },
    { key: 'push', targets: ['pectorals', 'triceps'], mode: 'reps', base: 10 },
    { key: 'hinge', targets: ['glutes', 'hamstrings'], mode: 'reps', base: 12 },
    { key: 'pull', targets: ['upper back', 'lats', 'biceps', 'traps'], mode: 'reps', base: 12 },
    { key: 'core', targets: ['abs', 'obliques', 'spine'], mode: 'reps', base: 15 },
    { key: 'cardio', targets: ['cardiovascular system'], mode: 'time', base: 40 },
  ];

  // exclude names that need gear the user lacks or are too exotic for a fast home circuit
  const BAN = /pull-up|pull up|chin-up|muscle up|hanging|captains chair|smith|lever|sled|handstand|planche|pike push|one arm push-up|wheel|l-sit|front lever|back lever|skin the cat|human flag|decline|incline bench|preacher|bosu|maltese|iron cross|v\. 2|v\. 3|\(male\)|\(female\)|\(back pov\)|\(side pov\)|assisted|stretch|\brun\b|running|sprint|jog|walk|treadmill|bike|cycling|stepmill|elliptical|pose|posture|\bdips?\b|parallel bars|balance board|platform|inverted row|\bslide\b|rope|\bring\b|cannonball|battling/i;
  const USER_EQ = ['body weight', 'dumbbell', 'barbell', 'stability ball', 'trx'];

  function pool() {
    return window.EXERCISES.filter(function (e) {
      return USER_EQ.indexOf(e.equipment) !== -1 && !BAN.test(e.name);
    });
  }

  function generate(rng) {
    rng = rng || Math.random;
    const p = pool();
    const used = {};
    const items = SLOTS.map(function (slot) {
      let cands = p.filter(function (e) {
        return slot.targets.indexOf(e.target) !== -1 && !used[e.id];
      });
      // fallbacks so an exhausted slot never crashes the generator
      if (!cands.length) cands = p.filter(function (e) { return slot.targets.indexOf(e.target) !== -1; });
      if (!cands.length) cands = p.filter(function (e) { return !used[e.id]; });
      if (!cands.length) cands = p;
      const pick = cands[Math.floor(rng() * cands.length)];
      if (pick) used[pick.id] = true;
      return { ex: pick ? pick.id : (p[0] && p[0].id), mode: slot.mode, base: slot.base, top: slot.base, generated: true };
    });
    return { key: 'X', circuit: { rounds: 3, restExercise: 20, restRound: 90, items: items }, finisher: null };
  }

  window.PROGRAM = {
    warmup: WARMUP,
    sessions: SESSIONS,
    cooldown: COOLDOWN,
    suggest: suggest,
    generate: generate,
    substitute: substitute,
    makeCustom: makeCustom,
    daysSinceLast: daysSinceLast,
    DELOAD_AFTER_DAYS: 17,
    // which session is next: alternate A/B based on history
    nextSessionKey: function (history) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].session === 'A') return 'B';
        if (history[i].session === 'B') return 'A';
      }
      return 'A';
    },
  };
})();
