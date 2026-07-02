/* SPIEZZO — localStorage state + export/import + Google Sheet sync */
(function () {
  'use strict';

  const KEY = 'spiezzo.v1';

  const DEFAULTS = {
    lang: 'it',
    sound: true,
    vibrate: true,
    trainDays: [1, 4],            // Tue, Fri (0=Mon … 6=Sun)
    reminders: false,
    sheetUrl: '',
    lastSync: null,
    profile: { startWeight: null, targetWeight: null, startDate: null },
    weights: [],                  // { date: 'YYYY-MM-DD', kg: number }
    history: [],                  // { id, date, hour, session, minutes, volume, items: [{ex, sets:[{value, weight}]}] }
    xp: 0,                        // Rubli del Disagio
    badges: {},                   // badgeId -> date unlocked
    perf: {},                     // perf[sessionKey + ':' + exId] = { value, weight }
    pendingSync: [],              // record ids not yet pushed to the sheet
    sober: {                      // no-vodka streak
      challengeMonths: [0, 9],    // Dry January + Sober October by default (0=Jan … 11=Dec)
      startDate: null,            // first check-in or slip
      lastSlip: null,             // 'YYYY-MM-DD' of most recent slip, or null
      checkins: {},               // 'YYYY-MM-DD' -> true (for XP + streak-day dedupe)
      bestStreak: 0,
      slipCount: 0,
    },
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const s = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), s);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }

  // ISO week id like "2026-W27" (Mon-based)
  function weekId(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day + 3);
    const firstThu = new Date(d.getFullYear(), 0, 4);
    const fday = (firstThu.getDay() + 6) % 7;
    firstThu.setDate(firstThu.getDate() - fday + 3);
    const week = 1 + Math.round((d - firstThu) / (7 * 24 * 3600 * 1000));
    return d.getFullYear() + '-W' + String(week).padStart(2, '0');
  }

  const Store = {
    get: function () { return state; },
    set: function (patch) { Object.assign(state, patch); save(); },
    todayStr: todayStr,
    weekId: weekId,

    logWeight: function (kg) {
      const date = todayStr();
      const firstToday = !state.weights.some(function (w) { return w.date === date; });
      state.weights = state.weights.filter(function (w) { return w.date !== date; });
      state.weights.push({ date: date, kg: kg });
      state.weights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (!state.profile.startDate) state.profile.startDate = date;
      state.pendingSync.push('w:' + date);
      save();
      return firstToday;
    },

    logSession: function (rec) {
      rec.id = 's' + Date.now();
      rec.date = todayStr();
      rec.hour = new Date().getHours();
      state.history.push(rec);
      rec.items.forEach(function (it) {
        const lastSet = it.sets[it.sets.length - 1];
        if (lastSet) {
          state.perf[rec.session + ':' + it.ex] = { value: lastSet.value, weight: lastSet.weight || null };
        }
      });
      state.pendingSync.push(rec.id);
      save();
      return rec;
    },

    lastPerf: function (sessionKey, exId) {
      return state.perf[sessionKey + ':' + exId] || null;
    },

    sessionsThisWeek: function () {
      const wk = weekId(todayStr());
      return state.history.filter(function (h) { return weekId(h.date) === wk; }).length;
    },

    // streak: consecutive weeks (ending this or last week) with >=1 session
    streaks: function () {
      const weeks = {};
      state.history.forEach(function (h) { weeks[weekId(h.date)] = true; });
      const ids = Object.keys(weeks).sort();
      if (!ids.length) return { current: 0, best: 0, activeWeeks: 0 };
      let best = 1, run = 1;
      for (let i = 1; i < ids.length; i++) {
        run = consecutive(ids[i - 1], ids[i]) ? run + 1 : 1;
        if (run > best) best = run;
      }
      // current streak counts back from this week (or last week, grace period)
      const thisWk = weekId(todayStr());
      const lastD = new Date(); lastD.setDate(lastD.getDate() - 7);
      const lastWk = weekId(lastD.getFullYear() + '-' + String(lastD.getMonth() + 1).padStart(2, '0') + '-' + String(lastD.getDate()).padStart(2, '0'));
      let cur = 0, anchor = weeks[thisWk] ? thisWk : (weeks[lastWk] ? lastWk : null);
      if (anchor) {
        cur = 1;
        let idx = ids.indexOf(anchor);
        while (idx > 0 && consecutive(ids[idx - 1], ids[idx])) { cur++; idx--; }
      }
      return { current: cur, best: best, activeWeeks: ids.length };
    },

    soberCheckIn: function () {
      const date = todayStr();
      if (!state.sober.startDate) state.sober.startDate = date;
      const firstToday = !state.sober.checkins[date];
      state.sober.checkins[date] = true;
      save();
      return firstToday;
    },

    soberSlip: function () {
      const date = todayStr();
      if (!state.sober.startDate) state.sober.startDate = date;
      state.sober.lastSlip = date;
      state.sober.slipCount = (state.sober.slipCount || 0) + 1;
      save();
    },

    setSoberMonths: function (months) {
      state.sober.challengeMonths = months.slice().sort(function (a, b) { return a - b; });
      save();
    },

    // current/best streak of consecutive sober days, ending today (or reset by lastSlip)
    soberStatus: function () {
      const sb = state.sober;
      if (!sb.startDate) {
        return { current: 0, best: sb.bestStreak || 0, startDate: null, lastSlip: null, checkedToday: false, slipCount: sb.slipCount || 0 };
      }
      const anchor = sb.lastSlip ? addDays(sb.lastSlip, 1) : sb.startDate;
      const today = todayStr();
      const current = Math.max(0, daysBetween(anchor, today) + 1);
      if (current > (sb.bestStreak || 0)) { sb.bestStreak = current; save(); }
      return {
        current: current,
        best: sb.bestStreak || 0,
        startDate: sb.startDate,
        lastSlip: sb.lastSlip || null,
        checkedToday: !!sb.checkins[today],
        slipCount: sb.slipCount || 0,
      };
    },

    exportJSON: function () {
      return JSON.stringify(state, null, 2);
    },

    importJSON: function (text) {
      const s = JSON.parse(text);
      if (!s || typeof s !== 'object' || !Array.isArray(s.history)) throw new Error('bad file');
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), s);
      save();
    },

    /* ---- Google Sheet sync (Apps Script web app) ----
       POST { weights: [...], sessions: [...] } — the script upserts rows.
       Content-Type text/plain avoids the CORS preflight Apps Script can't answer. */
    sync: function () {
      if (!state.sheetUrl) return Promise.reject(new Error('no url'));
      const payload = {
        weights: state.weights,
        sessions: state.history.map(function (h) {
          return { id: h.id, date: h.date, session: h.session, minutes: h.minutes, volume: h.volume };
        }),
      };
      return fetch(state.sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function () {
        state.pendingSync = [];
        state.lastSync = new Date().toISOString();
        save();
      });
    },

    maybeAutoSync: function () {
      if (state.sheetUrl && state.pendingSync.length && navigator.onLine) {
        Store.sync().catch(function () { /* stay pending, retry next time */ });
      }
    },
  };

  function consecutive(a, b) {
    // b is exactly one ISO week after a
    const pa = a.split('-W'), pb = b.split('-W');
    const ya = +pa[0], wa = +pa[1], yb = +pb[0], wb = +pb[1];
    if (ya === yb) return wb === wa + 1;
    return yb === ya + 1 && wb === 1 && wa >= 52;
  }

  window.STORE = Store;
})();
