/* SPIEZZO — gamification: Drago mascot, Rubli del Disagio (XP), levels, badges */
(function () {
  'use strict';

  /* ---------- Drago, the mascot (flat SVG, ink + one orange) ---------- */
  const MASCOT = `
  <svg viewBox="0 0 120 132" class="drago" aria-hidden="true">
    <!-- shoulders / torso -->
    <path d="M14 132 C14 100 34 86 60 86 C86 86 106 100 106 132 Z" fill="#fc5200"/>
    <path d="M43 92 L60 116 L77 92" fill="none" stroke="#ffffff" stroke-width="5"/>
    <!-- neck -->
    <rect x="50" y="70" width="20" height="18" fill="#ffffff" stroke="#000" stroke-width="3"/>
    <!-- head -->
    <path d="M38 26 L82 26 L82 56 Q82 74 60 76 Q38 74 38 56 Z" fill="#ffffff" stroke="#000" stroke-width="3"/>
    <!-- flat-top hair -->
    <path d="M34 26 L86 26 L84 12 L36 12 Z" fill="#000"/>
    <rect x="34" y="24" width="52" height="5" fill="#000"/>
    <!-- stern brows -->
    <path d="M44 38 L56 42" stroke="#000" stroke-width="4" stroke-linecap="round"/>
    <path d="M76 38 L64 42" stroke="#000" stroke-width="4" stroke-linecap="round"/>
    <!-- eyes -->
    <rect x="47" y="45" width="6" height="3.5" fill="#000"/>
    <rect x="67" y="45" width="6" height="3.5" fill="#000"/>
    <!-- nose -->
    <path d="M60 46 L60 56 L56 58" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round"/>
    <!-- flat mouth -->
    <path d="M51 65 L69 65" stroke="#000" stroke-width="3.4" stroke-linecap="round"/>
    <!-- cheek shadow lines -->
    <path d="M42 52 L45 60" stroke="#000" stroke-width="1.6"/>
    <path d="M78 52 L75 60" stroke="#000" stroke-width="1.6"/>
  </svg>`;

  /* ---------- phrases (mangled Russian-Italian / Russian-English) ---------- */
  const PHRASES = {
    it: {
      greet_train: [
        'Io ti spiezzo in due... ruote.',
        'Tu allenare oggi. O io spiezzare divano. Con te sopra.',
        'Io non posso essere sconfitto. Tu invece... vedremo.',
        'Meno chiacchiere, compagno. Più squat.',
        'Tu non essere ancora pezzo di ferro. Ma oggi iniziare.',
      ],
      greet_rest: [
        'Oggi riposo. Anche macchina sovietica deve ricaricare.',
        'Riposare è allenamento. Ma bilancia lavorare sempre.',
        'Tu riposare adesso. Domani io spiezzare te.',
      ],
      greet_streak: [
        '{n} settimane di fila. Tu essere quasi pezzo di ferro.',
        'Striscia di {n} settimane. Drago quasi sorridere. Quasi.',
      ],
      done: [
        'Non male... per piccolo ciclista.',
        'Se grasso muore... muore.',
        'Tu iniziare a essere pezzo di ferro.',
        'Io quasi impressionato. Quasi.',
        'Oggi tu non essere sconfitto.',
      ],
      levelup: [
        'Tu salire di grado. Io ancora più forte. Ma tu salire.',
        'Nuovo grado, compagno. Unione del Disagio essere fiera.',
      ],
      badge: [
        'Medaglia per te. Da Russia con disagio.',
        'Tu vincere medaglia. Non piangere. Drago odiare lacrime.',
      ],
      weight_down: [
        'Grasso muore. Se muore... muore.',
        'Bilancia parlare. Drago approvare.',
        'Meno chili, più montagna. Buon lavoro, compagno.',
      ],
      weight_up: [
        'Tu mangiare troppo borscht.',
        'Bilancia non mentire. Drago nemmeno.',
        'Piccolo passo indietro. Grande spiezzamento domani.',
      ],
      weight_same: [
        'Bilancia ferma. Come inverno russo: lungo, ma passare.',
      ],
      skip: [
        'Tu saltare esercizio?! Drago vedere tutto.',
        'In Siberia nessuno saltare. Nemmeno corda.',
        'Salti tu? Io segnare su libretto nero.',
      ],
    },
    en: {
      greet_train: [
        'I must break you. In two wheels.',
        'Today you train. Or I break couch. With you on it.',
        'I cannot be defeated. You? We will see.',
        'Less talk, comrade. More squat.',
        'You are not yet piece of iron. But today you begin.',
      ],
      greet_rest: [
        'Today rest. Even Soviet machine must recharge.',
        'Rest is training. But scale always works.',
        'You rest now. Tomorrow I break you.',
      ],
      greet_streak: [
        '{n} weeks in a row. You are almost piece of iron.',
        'Streak of {n} weeks. Drago almost smiles. Almost.',
      ],
      done: [
        'Not bad... for little cyclist.',
        'If fat dies... it dies.',
        'You begin to be piece of iron.',
        'I am almost impressed. Almost.',
        'Today you are not defeated.',
      ],
      levelup: [
        'You rise in rank. I am still stronger. But you rise.',
        'New rank, comrade. Union of Discomfort is proud.',
      ],
      badge: [
        'Medal for you. From Russia with discomfort.',
        'You win medal. Do not cry. Drago hates tears.',
      ],
      weight_down: [
        'Fat dies. If it dies... it dies.',
        'Scale speaks. Drago approves.',
        'Fewer kilos, more mountain. Good work, comrade.',
      ],
      weight_up: [
        'You eat too much borscht.',
        'Scale does not lie. Drago neither.',
        'Small step back. Big breaking tomorrow.',
      ],
      weight_same: [
        'Scale is frozen. Like Russian winter: long, but it passes.',
      ],
      skip: [
        'You skip exercise?! Drago sees everything.',
        'In Siberia nobody skips. Not even rope.',
        'You skip? I write it in little black book.',
      ],
    },
  };

  function phrase(key, vars) {
    const lang = window.I18N.getLang();
    const list = (PHRASES[lang] || PHRASES.it)[key] || [];
    let p = list[Math.floor(Math.random() * list.length)] || '';
    if (vars) Object.keys(vars).forEach(function (k) { p = p.replace('{' + k + '}', vars[k]); });
    return p;
  }

  /* ---------- levels: Rubli del Disagio thresholds ---------- */
  const LEVELS = [
    { at: 0, it: 'Turista del Divano', en: 'Couch Tourist' },
    { at: 100, it: 'Recluta del Disagio', en: 'Recruit of Discomfort' },
    { at: 250, it: 'Soldato di Cantina', en: 'Basement Soldier' },
    { at: 500, it: 'Compagno di Ferro', en: 'Iron Comrade' },
    { at: 900, it: 'Trattore Siberiano', en: 'Siberian Tractor' },
    { at: 1400, it: 'Cremlino di Cosce', en: 'Kremlin of Quads' },
    { at: 2100, it: 'Macchina Sovietica', en: 'Soviet Machine' },
    { at: 3000, it: 'Quasi Drago', en: 'Almost Drago' },
    { at: 4200, it: 'Spiezzatore in Due', en: 'Breaker in Two' },
    { at: 5800, it: 'IVAN DRAGO', en: 'IVAN DRAGO' },
  ];

  function levelInfo(xp) {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
    const cur = LEVELS[i];
    const next = LEVELS[i + 1] || null;
    const lang = window.I18N.getLang();
    return {
      n: i + 1,
      name: cur[lang] || cur.it,
      nextName: next ? (next[lang] || next.it) : null,
      progress: next ? (xp - cur.at) / (next.at - cur.at) : 1,
      toNext: next ? next.at - xp : 0,
    };
  }

  /* ---------- badges ---------- */
  const BADGES = [
    { id: 'b_first', icon: '🥊', it: 'Prima Spiezzata', en: 'First Breaking', dit: 'Completa la prima sessione', den: 'Complete your first session' },
    { id: 'b_double', icon: '🔨', it: 'Doppietta', en: 'The Double', dit: '2 sessioni nella stessa settimana', den: '2 sessions in one week' },
    { id: 'b_10', icon: '🛠️', it: 'Dieci di Disagio', en: 'Ten of Discomfort', dit: '10 sessioni totali', den: '10 total sessions' },
    { id: 'b_25', icon: '🚜', it: 'Venticinque', en: 'Twenty-Five', dit: '25 sessioni totali', den: '25 total sessions' },
    { id: 'b_50', icon: '🏭', it: 'Piano Quinquennale', en: 'Five-Year Plan', dit: '50 sessioni totali', den: '50 total sessions' },
    { id: 'b_streak4', icon: '🔥', it: 'Mese di Ferro', en: 'Iron Month', dit: '4 settimane di fila', den: '4-week streak' },
    { id: 'b_streak12', icon: '❄️', it: 'Inverno Russo', en: 'Russian Winter', dit: '12 settimane di fila', den: '12-week streak' },
    { id: 'b_kg1', icon: '⚖️', it: 'Primo Chilo', en: 'First Kilo', dit: '-1 kg dalla partenza', den: '-1 kg from start' },
    { id: 'b_kg5', icon: '🪓', it: 'Cinque al Tappeto', en: 'Five Down', dit: '-5 kg dalla partenza', den: '-5 kg from start' },
    { id: 'b_goal', icon: '🏆', it: 'Obiettivo Spiezzato', en: 'Goal Broken', dit: 'Peso obiettivo raggiunto', den: 'Target weight reached' },
    { id: 'b_vol10k', icon: '🏋️', it: 'Diecimila', en: 'Ten Thousand', dit: '10.000 kg sollevati in totale', den: '10,000 kg lifted overall' },
    { id: 'b_random', icon: '🎲', it: 'Roulette Russa', en: 'Russian Roulette', dit: 'Completa un circuito A CASO', den: 'Complete a random circuit' },
    { id: 'b_dawn', icon: '🌅', it: 'Alba Sovietica', en: 'Soviet Dawn', dit: 'Sessione iniziata prima delle 8', den: 'Session started before 8 am' },
    { id: 'b_weigh7', icon: '📈', it: 'Amico della Bilancia', en: 'Friend of the Scale', dit: '7 pesate registrate', den: '7 weigh-ins logged' },
  ];

  function checkBadges(s) {
    const have = s.badges || {};
    const sessions = s.history.length;
    const streak = STORE.streaks();
    const vol = s.history.reduce(function (a, x) { return a + (x.volume || 0); }, 0);
    const wk = {};
    s.history.forEach(function (x) { const w = STORE.weekId(x.date); wk[w] = (wk[w] || 0) + 1; });
    const maxWk = Object.keys(wk).reduce(function (m, k) { return Math.max(m, wk[k]); }, 0);
    const lastKg = s.weights.length ? s.weights[s.weights.length - 1].kg : null;
    const cond = {
      b_first: sessions >= 1,
      b_double: maxWk >= 2,
      b_10: sessions >= 10,
      b_25: sessions >= 25,
      b_50: sessions >= 50,
      b_streak4: streak.best >= 4,
      b_streak12: streak.best >= 12,
      b_kg1: lastKg !== null && lastKg <= s.profile.startWeight - 1,
      b_kg5: lastKg !== null && lastKg <= s.profile.startWeight - 5,
      b_goal: lastKg !== null && lastKg <= s.profile.targetWeight,
      b_vol10k: vol >= 10000,
      b_random: s.history.some(function (x) { return x.session === 'X'; }),
      b_dawn: s.history.some(function (x) { return typeof x.hour === 'number' && x.hour < 8; }),
      b_weigh7: s.weights.length >= 7,
    };
    const fresh = [];
    BADGES.forEach(function (b) {
      if (cond[b.id] && !have[b.id]) {
        have[b.id] = STORE.todayStr();
        fresh.push(b);
      }
    });
    if (fresh.length) STORE.set({ badges: have });
    return fresh;
  }

  /* ---------- awards ---------- */
  function addXp(n) {
    const s = STORE.get();
    const before = levelInfo(s.xp || 0);
    const xp = (s.xp || 0) + n;
    STORE.set({ xp: xp });
    const after = levelInfo(xp);
    return { earned: n, total: xp, level: after, levelUp: after.n > before.n };
  }

  // call AFTER STORE.logSession
  function onSession(rec) {
    const s = STORE.get();
    const streak = STORE.streaks();
    let xp = 50 + Math.min(30, rec.minutes) + Math.min(20, Math.floor((rec.volume || 0) / 100));
    if (STORE.sessionsThisWeek() === 2) xp += 40;                 // Duolingo-style weekly combo
    xp += Math.min(50, 5 * streak.current);                       // streak bonus
    const fresh = checkBadges(s);
    xp += fresh.length * 25;
    const res = addXp(xp);
    res.badges = fresh;
    return res;
  }

  // call AFTER STORE.logWeight; prevKg = weigh-in before this one (may be null)
  function onWeight(kg, prevKg, firstToday) {
    const fresh = checkBadges(STORE.get());
    let xp = (firstToday ? 10 : 0) + fresh.length * 25;
    const res = xp ? addXp(xp) : { earned: 0, total: STORE.get().xp || 0, level: levelInfo(STORE.get().xp || 0), levelUp: false };
    res.badges = fresh;
    res.mood = prevKg === null ? 'weight_down' : kg < prevKg - 0.05 ? 'weight_down' : kg > prevKg + 0.05 ? 'weight_up' : 'weight_same';
    return res;
  }

  window.GAME = {
    mascot: MASCOT,
    phrase: phrase,
    levelInfo: levelInfo,
    badges: BADGES,
    onSession: onSession,
    onWeight: onWeight,
    badgeName: function (b) { const l = window.I18N.getLang(); return b[l] || b.it; },
    badgeDesc: function (b) { return window.I18N.getLang() === 'en' ? b.den : b.dit; },
  };
})();
