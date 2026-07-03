/* SPIEZZO — views, workout player, charts */
(function () {
  'use strict';

  const t = function (k) { return window.I18N.t(k); };
  const $ = function (sel, el) { return (el || document).querySelector(sel); };
  const EX = {};
  window.EXERCISES.forEach(function (e) { EX[e.id] = e; });

  const app = document.getElementById('app');
  let view = 'today';
  let generated = null;   // last "A CASO" session
  let scaleReaction = null; // one-shot Drago reaction on the weight view
  let soberReaction = null; // one-shot Drago reaction on the sober view
  let todayReaction = null; // one-shot Drago reaction on the today view (rides)
  let progressEx = null;    // exercise id being inspected on the progress view

  /* ---------- helpers ---------- */
  function h(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtDate(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString(window.I18N.getLang() === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' });
  }
  function fmtKg(n) {
    return (Math.round(n * 10) / 10).toLocaleString(window.I18N.getLang() === 'it' ? 'it-IT' : 'en-GB');
  }

  function beep(freq, dur) {
    if (!STORE.get().sound) return;
    try {
      const ctx = beep.ctx = beep.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 0.15));
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + (dur || 0.15));
    } catch (e) { /* no audio, no problem */ }
  }
  function buzz(pattern) {
    if (STORE.get().vibrate && navigator.vibrate) navigator.vibrate(pattern || 80);
  }

  // small Drago that slides in, comments, and leaves; mood: 'go' | 'skip'
  function dragoPop(mood, phraseKey) {
    const old = document.querySelector('.dragopop');
    if (old) old.remove();
    const el = h(`<div class="dragopop ${mood}">
      <div class="dbubble">${esc(GAME.phrase(phraseKey || mood))}</div>
      <div class="dwrap">${GAME.mascot}</div>
    </div>`);
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('show'); }, 20);
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); }, 2600);
  }

  function mascotCard(text, sub) {
    return `<section class="mascotcard">
      <div class="mwrap">${GAME.mascot}</div>
      <div class="mtext">
        <div class="bubble">${esc(text)}</div>
        ${sub ? '<div class="msub">' + sub + '</div>' : ''}
      </div>
    </section>`;
  }

  function xpBar(level) {
    return `<div class="xpwrap">
      <div class="xprow"><b>${esc(t('level'))} ${level.n} — ${esc(level.name)}</b><span>₽ ${(STORE.get().xp || 0).toLocaleString()}</span></div>
      <div class="xpbar"><i style="width:${Math.round(level.progress * 100)}%"></i></div>
      <div class="xpnext">${level.nextName ? level.toNext + ' ' + esc(t('to_next')) + ' · ' + esc(level.nextName) : esc(t('max_level'))}</div>
    </div>`;
  }

  /* ---------- navigation ---------- */
  function render() {
    document.querySelectorAll('.nav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.view === view);
      const lbl = b.querySelector('[data-nav-label]');
      if (lbl) lbl.textContent = t(lbl.dataset.navLabel);
    });
    if (view === 'today') renderToday();
    else if (view === 'train') renderTrain();
    else if (view === 'weight') renderWeight();
    else if (view === 'sober') renderSober();
    else if (view === 'stats') renderStats();
    else if (view === 'progress') renderProgress();
    else if (view === 'settings') renderSettings();
    app.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function nav(v) { view = v; render(); }

  /* ---------- TODAY ---------- */
  function renderToday() {
    const s = STORE.get();
    const nextKey = PROGRAM.nextSessionKey(s.history);
    const wk = STORE.sessionsThisWeek();
    const st = STORE.streaks();
    const last = s.history[s.history.length - 1];
    const dow = (new Date().getDay() + 6) % 7;
    const isTrainDay = s.trainDays.indexOf(dow) !== -1;
    const lastW = s.weights[s.weights.length - 1];
    const rideWk = STORE.ridesThisWeek();
    const custom = s.custom;

    let reactionHtml = '';
    if (todayReaction) {
      const r = todayReaction;
      const sub = (r.earned ? '+' + r.earned + ' ₽' : '') +
        (r.badges.length ? ' · ' + r.badges.map(function (b) { return b.icon + ' ' + esc(GAME.badgeName(b)); }).join(' · ') : '');
      reactionHtml = mascotCard(GAME.phrase(r.mood), sub || null);
      todayReaction = null;
    }

    app.innerHTML = `
      <header class="masthead">
        <div class="brand">SPIEZ<span>ZO</span></div>
        <div class="tag">${esc(t('tagline'))}<br><em>${esc(t('subline'))}</em></div>
        <button class="gear" data-nav="settings" aria-label="${esc(t('settings'))}">⚙</button>
      </header>
      ${reactionHtml || (function () {
        const lvl = GAME.levelInfo(s.xp || 0);
        const msg = !isTrainDay ? GAME.phrase('greet_rest')
          : st.current >= 2 && Math.random() < 0.5 ? GAME.phrase('greet_streak', { n: st.current })
          : GAME.phrase('greet_train');
        return mascotCard(msg, esc(t('level')) + ' ' + lvl.n + ' — ' + esc(lvl.name) + ' · ₽ ' + (s.xp || 0).toLocaleString());
      })()}
      ${backupNudge(s)}
      <section class="card hero">
        <div class="kicker">${esc(t('today_next'))} · ${esc(isTrainDay ? t('today_is_trainday') : t('today_is_restday'))}</div>
        <h2>${esc(t('session_' + nextKey))}</h2>
        <button class="btn big" id="start">${esc(t('today_start'))}</button>
        ${custom ? `<button class="btn ghost" id="startcustom">${esc(t('today_saved'))}</button>` : ''}
        <button class="btn ghost" id="random">${esc(t('today_random'))}</button>
        <button class="btn ghost" id="ride">${esc(t('today_log_ride'))}</button>
        <div class="hint">${esc(t('today_random_hint'))}</div>
      </section>
      <section class="tiles">
        <div class="tile"><b>${wk}<i>/2</i></b><span>${esc(t('today_done_week'))}</span></div>
        <div class="tile"><b>${rideWk}<i>🚵</i></b><span>${esc(t('today_rides_week'))}</span></div>
        <div class="tile"><b>${st.current}</b><span>${esc(t('today_streak'))}</span></div>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('today_last'))}</div>
        <div class="lastline">${last ? esc(t('session_' + last.session)) + ' — ' + fmtDate(last.date) + ' · ' + last.minutes + ' min' : esc(t('today_never'))}</div>
        <div class="hint">${esc(t('week_target'))} ${esc(t('today_ride_note'))}</div>
      </section>`;
    $('#start').onclick = function () { startWorkout(PROGRAM.sessions[nextKey]); };
    if (custom) $('#startcustom').onclick = function () { startWorkout(s.custom); };
    $('#random').onclick = function () { generated = PROGRAM.generate(); view = 'train'; render(); };
    $('#ride').onclick = logRide;
    bindNavData();
  }

  // one-tap MTB ride log (counts toward the weekly streak, earns rubli)
  function logRide() {
    const raw = prompt(t('ride_prompt'), '');
    if (raw === null) return;              // cancelled
    const mins = Math.max(0, parseInt(String(raw).replace(/[^0-9]/g, ''), 10) || 0);
    STORE.logRide(mins);
    todayReaction = GAME.onRide(mins);
    STORE.maybeAutoSync();
    buzz(50); beep(660, 0.12);
    render();
  }

  // gentle nudge to back up when there's real data at risk and no recent sync/export
  function backupNudge(s) {
    const items = s.history.length + s.weights.length + (s.rides ? s.rides.length : 0);
    if (items < 8) return '';
    if (s.sheetUrl) return '';            // auto-sync covers them
    const ref = s.lastExport ? new Date(s.lastExport).getTime() : 0;
    const daysAgo = (Date.now() - ref) / 86400000;
    if (daysAgo < 21) return '';
    return `<section class="card nudge" data-nav="settings">
      <div class="kicker">${esc(t('backup_nudge_kicker'))}</div>
      <div class="lastline">${esc(t('backup_nudge_body'))}</div>
    </section>`;
  }

  /* ---------- TRAIN (session preview) ---------- */
  function renderTrain() {
    const s = STORE.get();
    const nextKey = PROGRAM.nextSessionKey(s.history);
    const session = generated || PROGRAM.sessions[nextKey];
    const isGen = !!generated;
    const gap = PROGRAM.daysSinceLast(s.history);
    const sugOpts = { deload: isFinite(gap) && gap >= PROGRAM.DELOAD_AFTER_DAYS };

    function itemRow(item) {
      const e = EX[item.ex];
      const sug = PROGRAM.suggest(item, STORE.lastPerf(session.key, item.ex), sugOpts);
      const qty = item.mode === 'time' ? sug.value + '″' : sug.value + (item.perSide ? '×2' : '');
      const w = item.weighted && sug.weight ? ' · ' + fmtKg(sug.weight) + ' kg' : '';
      return `<li><span class="qty">${qty}</span><span class="nm">${esc(window.I18N.exName(e))}${w}</span><span class="eq">${esc(e.equipment)}</span></li>`;
    }

    app.innerHTML = `
      <header class="pagehead"><h1>${esc(t('session_' + session.key))}</h1>${isGen ? `<div class="hint">${esc(t('generated_note'))}</div>` : ''}</header>
      <section class="card">
        <div class="kicker">${esc(t('phase_warmup'))} · ~8 min</div>
        <ul class="exlist">${PROGRAM.warmup.items.map(itemRow).join('')}</ul>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('phase_circuit'))} · ${session.circuit.rounds} ${esc(t('round')).toLowerCase()}${window.I18N.getLang() === 'it' ? 'i' : 's'}</div>
        <ul class="exlist">${session.circuit.items.map(itemRow).join('')}</ul>
      </section>
      ${session.finisher ? `<section class="card">
        <div class="kicker">${esc(t('phase_finisher'))} · ${session.finisher.rounds}×</div>
        <ul class="exlist">${session.finisher.items.map(itemRow).join('')}</ul>
      </section>` : ''}
      <div class="stickybar">
        ${isGen ? `<button class="btn ghost" id="regen">${esc(t('regenerate'))}</button>
        <button class="btn ghost" id="savecircuit">${esc(t('save_circuit'))}</button>` : ''}
        <button class="btn big" id="start">${esc(t('today_start'))}</button>
      </div>`;
    $('#start').onclick = function () { startWorkout(session); };
    if (isGen) {
      $('#regen').onclick = function () { generated = PROGRAM.generate(); render(); };
      $('#savecircuit').onclick = function () {
        STORE.saveCustom(PROGRAM.makeCustom(session));
        dragoPop('go', 'save_circuit');
        buzz(50); beep(660, 0.12);
      };
    }
  }

  /* ---------- WORKOUT PLAYER ---------- */
  function buildQueue(session) {
    const q = [];
    PROGRAM.warmup.items.forEach(function (item, i) {
      q.push({ type: 'ex', phase: 'warmup', item: item, round: 1, rounds: 1, log: false });
    });
    ['circuit', 'finisher'].forEach(function (part) {
      const p = session[part];
      if (!p) return;
      for (let r = 1; r <= p.rounds; r++) {
        p.items.forEach(function (item, i) {
          q.push({ type: 'ex', phase: part, item: item, round: r, rounds: p.rounds, log: true });
          const isLastEx = i === p.items.length - 1;
          const isLastRound = r === p.rounds;
          if (!(isLastEx && isLastRound)) {
            q.push({ type: 'rest', secs: isLastEx ? p.restRound : p.restExercise, roundRest: isLastEx });
          }
        });
      }
    });
    PROGRAM.cooldown.forEach(function (c) {
      q.push({ type: 'cool', item: c });
    });
    return q;
  }

  function startWorkout(session) {
    const queue = buildQueue(session);
    const startedAt = Date.now();
    const weights = {};  // exId -> chosen kg for this session
    const logs = {};     // exId -> { ex, sets: [] }
    let idx = 0;
    let timer = null;
    const gap = PROGRAM.daysSinceLast(STORE.get().history);
    const deload = isFinite(gap) && gap >= PROGRAM.DELOAD_AFTER_DAYS;
    const sugOpts = { deload: deload };

    // preload suggested weights
    session.circuit.items.concat(session.finisher ? session.finisher.items : []).forEach(function (item) {
      const sug = PROGRAM.suggest(item, STORE.lastPerf(session.key, item.ex), sugOpts);
      if (item.weighted) weights[item.ex] = sug.weight || 0;
    });

    const overlay = h('<div class="player"></div>');
    document.body.appendChild(overlay);
    document.body.classList.add('locked');
    if (deload) setTimeout(function () { dragoPop('go', 'comeback'); }, 400);

    let wakeLock = null;
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {});

    function close() {
      if (timer) clearInterval(timer);
      if (wakeLock) wakeLock.release().catch(function () {});
      overlay.remove();
      document.body.classList.remove('locked');
      render();
    }

    function nextUpLabel() {
      for (let j = idx + 1; j < queue.length; j++) {
        if (queue[j].type === 'ex') return window.I18N.exName(EX[queue[j].item.ex]);
        if (queue[j].type === 'cool') return t(queue[j].item.key === 'quad' ? 'cool_quad' : 'cool_' + queue[j].item.key);
      }
      return t('workout_complete');
    }

    function progressBar() {
      const pct = Math.round(idx / queue.length * 100);
      return `<div class="pbar"><i style="width:${pct}%"></i></div>`;
    }

    function step() {
      if (timer) { clearInterval(timer); timer = null; }
      if (idx >= queue.length) return finish();
      const st = queue[idx];
      if (st.type === 'rest') return renderRest(st);
      if (st.type === 'cool') return renderCool(st);
      return renderEx(st);
    }

    function renderEx(st) {
      const e = EX[st.item.ex];
      const sug = PROGRAM.suggest(st.item, STORE.lastPerf(session.key, st.item.ex), sugOpts);
      const isTime = st.item.mode === 'time';
      const target = isTime ? sug.value : sug.value;
      const steps = window.I18N.steps(e);
      const canSwap = st.phase !== 'warmup';
      overlay.innerHTML = `
        ${progressBar()}
        <div class="phead">
          <span class="phase">${esc(t('phase_' + st.phase))}${st.rounds > 1 ? ' · ' + t('round') + ' ' + st.round + '/' + st.rounds : ''}</span>
          <span class="pheadbtns">
            ${canSwap ? `<button class="x" id="swap" title="${esc(t('btn_swap'))}" aria-label="${esc(t('btn_swap'))}">⇄</button>` : ''}
            <button class="x" id="abort">✕</button>
          </span>
        </div>
        <div class="pbody">
          <div class="ptarget">${isTime ? target + '″' : target + ' ' + esc(t('reps'))}${st.item.perSide ? ' <small>' + esc(t('per_side')) + '</small>' : ''}${sug.bumpWeight ? '<div class="bump">' + esc(t('bump_weight')) + '</div>' : ''}${sug.deloaded ? '<div class="bump deload">' + esc(t('deload_note')) + '</div>' : ''}</div>
          <h2 class="pex">${esc(window.I18N.exName(e))}</h2>
          ${st.item.weighted ? `<label class="wrow">${esc(t('weight_prompt'))}
             <input type="number" step="0.5" min="0" inputmode="decimal" id="wkg" value="${weights[st.item.ex] || ''}"> ${esc(t('weight_kg'))}</label>` : ''}
          <ol class="psteps">${steps.map(function (s2) { return '<li>' + esc(s2) + '</li>'; }).join('')}</ol>
          ${isTime ? `<div class="ptimer" id="tdisp">${target}</div>` : ''}
        </div>
        <div class="pfoot">
          <button class="btn ghost" id="skip">${esc(t('btn_skip'))}</button>
          <button class="btn big" id="main">${isTime ? esc(t('btn_start_timer')) : esc(t('btn_done'))}</button>
        </div>`;
      $('#abort', overlay).onclick = function () { if (confirm(t('abort_confirm'))) close(); };
      if (canSwap) $('#swap', overlay).onclick = function () {
        const sub = PROGRAM.substitute(st.item.ex);
        if (!sub) { dragoPop('skip', 'skip'); return; }
        st.item.ex = sub.id;               // same object across rounds → swap sticks for the rest
        delete weights[sub.id];
        renderEx(st);
      };
      $('#skip', overlay).onclick = function () {
        dragoPop('skip');
        idx++; step();
      };
      const done = function (value) {
        if (st.log) {
          const kgEl = $('#wkg', overlay);
          const kg = kgEl ? parseFloat(kgEl.value) || 0 : null;
          if (kgEl) weights[st.item.ex] = kg;
          if (!logs[st.item.ex]) logs[st.item.ex] = { ex: st.item.ex, sets: [] };
          logs[st.item.ex].sets.push({ value: value, weight: st.item.weighted ? kg : null });
        }
        buzz(60); beep(660, 0.1);
        idx++; step();
      };
      if (isTime) {
        $('#main', overlay).onclick = function () {
          const btn = this; btn.disabled = true;
          dragoPop('go');
          runCountdown(target, $('#tdisp', overlay), function () { done(target); });
        };
      } else {
        $('#main', overlay).onclick = function () { done(target); };
      }
    }

    function renderRest(st) {
      overlay.innerHTML = `
        ${progressBar()}
        <div class="phead"><span class="phase">${esc(st.roundRest ? t('rest_round') : t('rest'))}</span><button class="x" id="abort">✕</button></div>
        <div class="pbody rest">
          <div class="ptimer huge" id="tdisp">${st.secs}</div>
          <div class="nextup">${esc(t('next_up'))}: <b>${esc(nextUpLabel())}</b></div>
        </div>
        <div class="pfoot"><button class="btn big" id="skip">${esc(t('btn_skip'))} →</button></div>`;
      $('#abort', overlay).onclick = function () { if (confirm(t('abort_confirm'))) close(); };
      $('#skip', overlay).onclick = function () { dragoPop('skip', 'skip_rest'); if (timer) clearInterval(timer); idx++; step(); };
      runCountdown(st.secs, $('#tdisp', overlay), function () { idx++; step(); });
    }

    function renderCool(st) {
      const total = st.item.time;
      overlay.innerHTML = `
        ${progressBar()}
        <div class="phead"><span class="phase">${esc(t('phase_cooldown'))}</span><button class="x" id="abort">✕</button></div>
        <div class="pbody">
          <h2 class="pex">${esc(t('cool_' + st.item.key))}${st.item.perSide ? ' <small>' + esc(t('per_side')) + '</small>' : ''}</h2>
          <p class="cue">${esc(t('cool_' + st.item.key + '_cue'))}</p>
          <div class="ptimer" id="tdisp">${total}</div>
        </div>
        <div class="pfoot">
          <button class="btn ghost" id="skip">${esc(t('btn_skip'))}</button>
          <button class="btn big" id="main">${esc(t('btn_start_timer'))}</button>
        </div>`;
      $('#abort', overlay).onclick = function () { if (confirm(t('abort_confirm'))) close(); };
      $('#skip', overlay).onclick = function () { dragoPop('skip'); if (timer) clearInterval(timer); idx++; step(); };
      $('#main', overlay).onclick = function () {
        this.disabled = true;
        dragoPop('go');
        runCountdown(total, $('#tdisp', overlay), function () { idx++; step(); });
      };
    }

    function runCountdown(secs, disp, onEnd) {
      let left = secs;
      disp.textContent = left;
      timer = setInterval(function () {
        left--;
        if (left <= 0) {
          clearInterval(timer); timer = null;
          beep(880, 0.25); buzz([80, 60, 80]);
          onEnd();
        } else {
          disp.textContent = left;
          if (left <= 3) beep(440, 0.08);
        }
      }, 1000);
    }

    function finish() {
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const items = Object.keys(logs).map(function (k) { return logs[k]; });
      let volume = 0;
      items.forEach(function (it) {
        it.sets.forEach(function (s2) { if (s2.weight) volume += s2.weight * s2.value; });
      });
      volume = Math.round(volume);
      overlay.innerHTML = `
        <div class="pbody donebody">
          <div class="doneflag">${esc(t('workout_complete'))}</div>
          <p class="cue">${esc(t('workout_complete_sub'))}</p>
          <div class="tiles">
            <div class="tile"><b>${minutes}<i>min</i></b><span>${esc(t('workout_time'))}</span></div>
            <div class="tile"><b>${volume}<i>kg</i></b><span>${esc(t('workout_volume'))}</span></div>
          </div>
        </div>
        <div class="pfoot"><button class="btn big" id="save">${esc(t('workout_save'))}</button></div>`;
      beep(660, 0.2); setTimeout(function () { beep(880, 0.3); }, 220); buzz([100, 80, 100, 80, 200]);
      $('#save', overlay).onclick = function () {
        STORE.logSession({ session: session.key, minutes: minutes, volume: volume, items: items });
        const reward = GAME.onSession(STORE.get().history[STORE.get().history.length - 1]);
        STORE.maybeAutoSync();
        generated = null;
        view = 'today';
        renderReward(reward);
      };
    }

    function renderReward(reward) {
      const say = reward.levelUp ? GAME.phrase('levelup')
        : reward.badges.length ? GAME.phrase('badge')
        : GAME.phrase('done');
      overlay.innerHTML = `
        <div class="pbody donebody reward">
          <div class="mwrap big">${GAME.mascot}</div>
          <div class="bubble center">${esc(say)}</div>
          ${reward.levelUp ? '<div class="lvlup">' + esc(t('levelup_title')) + '</div>' : ''}
          <div class="xpearn">+${reward.earned} <small>${esc(t('xp_earned'))}</small></div>
          ${xpBar(reward.level)}
          ${reward.badges.length ? `<div class="newbadges">
            ${reward.badges.map(function (b) {
              return '<div class="badge unlocked fresh"><span class="bicon">' + b.icon + '</span><b>' + esc(GAME.badgeName(b)) + '</b><small>' + esc(GAME.badgeDesc(b)) + '</small></div>';
            }).join('')}
          </div>` : ''}
        </div>
        <div class="pfoot"><button class="btn big" id="go">${esc(t('btn_continue'))}</button></div>`;
      if (reward.levelUp || reward.badges.length) { beep(523, 0.12); setTimeout(function () { beep(659, 0.12); }, 140); setTimeout(function () { beep(784, 0.25); }, 280); }
      $('#go', overlay).onclick = function () { close(); };
    }

    step();
  }

  /* ---------- WEIGHT ---------- */
  function movingAvg(weights, days) {
    return weights.map(function (w, i) {
      const from = new Date(w.date + 'T12:00:00'); from.setDate(from.getDate() - days + 1);
      const fromStr = from.toISOString().slice(0, 10);
      const win = weights.filter(function (x) { return x.date >= fromStr && x.date <= w.date; });
      return { date: w.date, kg: win.reduce(function (a, x) { return a + x.kg; }, 0) / win.length };
    });
  }

  function renderWeight() {
    const s = STORE.get();
    const ws = s.weights;
    const start = s.profile.startWeight, goal = s.profile.targetWeight;

    if (start == null || goal == null) {
      app.innerHTML = `
        <header class="pagehead"><h1>${esc(t('weight_title'))}</h1></header>
        ${mascotCard(GAME.phrase('setup'))}
        <section class="card">
          <div class="kicker">${esc(t('setup_kicker'))}</div>
          <form id="pform">
            <label class="lbl">${esc(t('setup_start'))}
              <input type="number" step="0.1" min="30" max="250" inputmode="decimal" id="pstart" placeholder="${esc(t('weight_placeholder'))}" required>
            </label>
            <label class="lbl">${esc(t('setup_goal'))}
              <input type="number" step="0.1" min="30" max="250" inputmode="decimal" id="pgoal" required>
            </label>
            <button class="btn" type="submit">${esc(t('setup_save'))}</button>
          </form>
          <div class="hint">${esc(t('setup_hint'))}</div>
        </section>`;
      $('#pform').onsubmit = function (ev) {
        ev.preventDefault();
        const a = parseFloat(String($('#pstart').value).replace(',', '.'));
        const b = parseFloat(String($('#pgoal').value).replace(',', '.'));
        if (!a || !b || a < 30 || b < 30 || a > 250 || b > 250) return;
        STORE.set({ profile: Object.assign({}, s.profile, { startWeight: a, targetWeight: b }) });
        if (!s.weights.length) {
          const firstToday = STORE.logWeight(a);
          scaleReaction = GAME.onWeight(a, null, firstToday);
        }
        buzz(50);
        render();
      };
      return;
    }
    const now = ws.length ? ws[ws.length - 1].kg : start;
    const lost = start - now, togo = now - goal;

    let paceMsg = '', projection = '';
    if (ws.length >= 2) {
      const first = ws[0], lastW = ws[ws.length - 1];
      const daysSpan = Math.max(1, (new Date(lastW.date) - new Date(first.date)) / 86400000);
      const perWeek = (first.kg - lastW.kg) / daysSpan * 7;
      paceMsg = perWeek > 0.8 ? t('weight_pace_fast') : perWeek >= 0.25 ? t('weight_pace_good') : t('weight_pace_slow');
      if (perWeek > 0.05 && togo > 0) {
        const weeks = togo / perWeek;
        const d = new Date(); d.setDate(d.getDate() + Math.round(weeks * 7));
        projection = t('weight_projection').replace('{goal}', fmtKg(goal)) + ' ' + d.toLocaleDateString(window.I18N.getLang() === 'it' ? 'it-IT' : 'en-GB', { month: 'long', year: 'numeric' });
      }
    }

    let reactionHtml = '';
    if (scaleReaction) {
      const r = scaleReaction;
      const sub = (r.earned ? '+' + r.earned + ' ₽ · ' : '') +
        r.badges.map(function (b) { return b.icon + ' ' + esc(GAME.badgeName(b)); }).join(' · ');
      reactionHtml = mascotCard(GAME.phrase(r.mood), sub || null);
      scaleReaction = null;
    }

    app.innerHTML = `
      <header class="pagehead"><h1>${esc(t('weight_title'))}</h1></header>
      ${reactionHtml}
      <section class="card">
        <form id="wform" class="wentry">
          <input type="number" step="0.1" min="30" max="250" inputmode="decimal" id="winput" placeholder="${esc(t('weight_placeholder'))}" required>
          <button class="btn" type="submit">${esc(t('weight_save'))}</button>
        </form>
      </section>
      <section class="tiles">
        <div class="tile"><b>${fmtKg(start)}<i>kg</i></b><span>${esc(t('weight_start'))}</span></div>
        <div class="tile hot"><b>${fmtKg(now)}<i>kg</i></b><span>${esc(t('weight_now'))}</span></div>
        <div class="tile"><b>${fmtKg(goal)}<i>kg</i></b><span>${esc(t('weight_goal'))}</span></div>
      </section>
      <section class="tiles two">
        <div class="tile"><b>${fmtKg(Math.max(0, lost))}<i>kg</i></b><span>${esc(t('weight_lost'))}</span></div>
        <div class="tile"><b>${fmtKg(Math.max(0, togo))}<i>kg</i></b><span>${esc(t('weight_togo'))}</span></div>
      </section>
      <section class="card">
        ${ws.length ? chartSVG(ws, start, goal) : '<div class="hint">' + esc(t('weight_empty')) + '</div>'}
        ${paceMsg ? '<div class="pace">' + esc(paceMsg) + '</div>' : ''}
        ${projection ? '<div class="hint">' + esc(projection) + '</div>' : ''}
      </section>`;
    $('#wform').onsubmit = function (ev) {
      ev.preventDefault();
      const v = parseFloat($('#winput').value.replace(',', '.'));
      if (v && v > 30 && v < 250) {
        const prev = STORE.get().weights;
        const prevKg = prev.length ? prev[prev.length - 1].kg : null;
        const firstToday = STORE.logWeight(v);
        scaleReaction = GAME.onWeight(v, prevKg, firstToday);
        STORE.maybeAutoSync();
        buzz(50);
        render();
      }
    };
  }

  function chartSVG(ws, start, goal) {
    const W = 640, H = 300, P = { l: 46, r: 14, t: 16, b: 28 };
    const avg = movingAvg(ws, 7);
    const allKg = ws.map(function (w) { return w.kg; }).concat([start, goal]);
    const min = Math.floor(Math.min.apply(null, allKg)) - 1;
    const max = Math.ceil(Math.max.apply(null, allKg)) + 1;
    const t0 = new Date(ws[0].date).getTime();
    const t1 = Math.max(new Date(ws[ws.length - 1].date).getTime(), t0 + 86400000 * 14);
    const x = function (date) { return P.l + (new Date(date).getTime() - t0) / (t1 - t0) * (W - P.l - P.r); };
    const y = function (kg) { return P.t + (max - kg) / (max - min) * (H - P.t - P.b); };
    const pts = function (arr) { return arr.map(function (w) { return x(w.date).toFixed(1) + ',' + y(w.kg).toFixed(1); }).join(' '); };
    // horizontal gridlines every 2 kg
    let grid = '';
    for (let k = min; k <= max; k += 2) {
      grid += `<line x1="${P.l}" y1="${y(k)}" x2="${W - P.r}" y2="${y(k)}" class="grid"/><text x="${P.l - 8}" y="${y(k) + 4}" class="axis">${k}</text>`;
    }
    const dots = ws.map(function (w) { return `<circle cx="${x(w.date)}" cy="${y(w.kg)}" r="3.5" class="dot"/>`; }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">
      ${grid}
      <line x1="${P.l}" y1="${y(goal)}" x2="${W - P.r}" y2="${y(goal)}" class="goal"/>
      <text x="${W - P.r}" y="${y(goal) - 6}" text-anchor="end" class="goallbl">${goal} kg</text>
      <polyline points="${pts(ws)}" class="raw"/>
      <polyline points="${pts(avg)}" class="avg"/>
      ${dots}
    </svg>
    <div class="legend"><span class="lg raw"></span>kg <span class="lg avg"></span>${esc(t('weight_trend'))}</div>`;
  }

  /* ---------- SOBER (no-vodka streak) ---------- */
  function renderSober() {
    const s = STORE.get();
    const sober = s.sober;
    const st = STORE.soberStatus();
    const months = t('months_short');

    let reactionHtml;
    if (soberReaction) {
      const r = soberReaction;
      const sub = (r.earned ? '+' + r.earned + ' ₽' : '') +
        (r.badges.length ? ' · ' + r.badges.map(function (b) { return b.icon + ' ' + esc(GAME.badgeName(b)); }).join(' · ') : '');
      reactionHtml = mascotCard(GAME.phrase(r.mood), sub || null);
      soberReaction = null;
    } else {
      reactionHtml = mascotCard(GAME.phrase('sober_greet'), st.startDate ? esc(t('sober_since')) + ' ' + fmtDate(st.startDate) : null);
    }

    app.innerHTML = `
      <header class="pagehead"><h1>${esc(t('sober_title'))}</h1></header>
      ${reactionHtml}
      <section class="tiles">
        <div class="tile hot"><b>${st.current}</b><span>${esc(t('sober_streak_current'))}</span></div>
        <div class="tile"><b>${st.best}</b><span>${esc(t('sober_streak_best'))}</span></div>
        <div class="tile"><b>${st.slipCount}</b><span>${esc(t('sober_slips'))}</span></div>
      </section>
      <section class="card">
        <button class="btn big" id="soberok" ${st.checkedToday ? 'disabled' : ''}>${esc(st.checkedToday ? t('sober_checked_today') : t('sober_checkin_btn'))}</button>
        <button class="btn ghost" id="soberslip">${esc(t('sober_slip_btn'))}</button>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('sober_months_kicker'))}</div>
        <div class="days">${months.map(function (m, i) {
          return '<button data-month="' + i + '" class="' + (sober.challengeMonths.indexOf(i) !== -1 ? 'on' : '') + '">' + esc(m) + '</button>';
        }).join('')}</div>
        <div class="hint">${esc(t('sober_months_hint'))}</div>
      </section>`;

    $('#soberok').onclick = function () {
      if (st.checkedToday) return;
      const firstToday = STORE.soberCheckIn();
      soberReaction = GAME.onSoberCheckIn(firstToday);
      buzz(50); beep(660, 0.12);
      render();
    };
    $('#soberslip').onclick = function () {
      if (!confirm(t('sober_slip_confirm'))) return;
      STORE.soberSlip();
      soberReaction = GAME.onSoberSlip();
      buzz([80, 60, 80]);
      render();
    };
    document.querySelectorAll('[data-month]').forEach(function (b) {
      b.onclick = function () {
        const m = +b.dataset.month;
        const list = STORE.get().sober.challengeMonths.slice();
        const idx = list.indexOf(m);
        if (idx === -1) list.push(m); else list.splice(idx, 1);
        STORE.setSoberMonths(list);
        render();
      };
    });
  }

  /* ---------- STATS ---------- */
  function renderStats() {
    const s = STORE.get();
    const st = STORE.streaks();
    const minutes = s.history.reduce(function (a, x) { return a + (x.minutes || 0); }, 0);
    const volume = s.history.reduce(function (a, x) { return a + (x.volume || 0); }, 0);
    const rides = s.rides || [];
    // merge sessions + rides into one dated feed
    const feed = s.history.map(function (x) {
      return { date: x.date, label: esc(x.session), detail: x.minutes + ' min · ' + x.volume + ' kg' };
    }).concat(rides.map(function (r) {
      return { date: r.date, label: '🚵', detail: (r.minutes ? r.minutes + ' min · ' : '') + t('ride_label') };
    })).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 30);
    const rows = feed.map(function (x) {
      return `<li><span class="qty">${x.label}</span><span class="nm">${fmtDate(x.date)}</span><span class="eq">${esc(x.detail)}</span></li>`;
    }).join('');
    const tracked = STORE.trackedExercises(2);
    const lvl = GAME.levelInfo(s.xp || 0);
    const sober = STORE.soberStatus();
    const badgeGrid = GAME.badges.map(function (b) {
      const got = (s.badges || {})[b.id];
      return `<div class="badge ${got ? 'unlocked' : 'locked'}">
        <span class="bicon">${b.icon}</span>
        <b>${esc(GAME.badgeName(b))}</b>
        <small>${esc(got ? fmtDate(got) : GAME.badgeDesc(b))}</small>
      </div>`;
    }).join('');

    app.innerHTML = `
      <header class="pagehead"><h1>${esc(t('stats_title'))}</h1></header>
      <section class="card lvlcard">
        <div class="mwrap">${GAME.mascot}</div>
        ${xpBar(lvl)}
      </section>
      <section class="tiles two">
        <div class="tile hot"><b>${s.history.length}</b><span>${esc(t('stats_sessions'))}</span></div>
        <div class="tile"><b>${st.activeWeeks}</b><span>${esc(t('stats_weeks'))}</span></div>
      </section>
      <section class="tiles two">
        <div class="tile"><b>${st.current}</b><span>${esc(t('stats_streak'))}</span></div>
        <div class="tile"><b>${st.best}</b><span>${esc(t('stats_best_streak'))}</span></div>
      </section>
      <section class="tiles two">
        <div class="tile"><b>${minutes}</b><span>${esc(t('stats_minutes'))}</span></div>
        <div class="tile"><b>${Math.round(volume).toLocaleString()}</b><span>${esc(t('stats_volume'))}</span></div>
      </section>
      <section class="tiles two">
        <div class="tile hot"><b>${sober.current}</b><span>${esc(t('stats_sober_streak'))}</span></div>
        <div class="tile"><b>${sober.best}</b><span>${esc(t('stats_sober_best'))}</span></div>
      </section>
      <section class="tiles two">
        <div class="tile"><b>${rides.length}</b><span>${esc(t('stats_rides'))}</span></div>
        <div class="tile"><b>${st.best}</b><span>${esc(t('stats_best_streak'))}</span></div>
      </section>
      <section class="card">
        ${tracked.length ? `<button class="btn ghost" id="toprogress">${esc(t('progress_open'))}</button>` : ''}
        <button class="btn ghost" id="recap">${esc(t('recap_share'))}</button>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('badges_title'))}</div>
        <div class="badges">${badgeGrid}</div>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('stats_history'))}</div>
        ${rows ? '<ul class="exlist">' + rows + '</ul>' : '<div class="hint">' + esc(t('stats_empty')) + '</div>'}
      </section>`;
    if (tracked.length) $('#toprogress').onclick = function () { progressEx = null; nav('progress'); };
    $('#recap').onclick = shareRecap;
  }

  /* ---------- PROGRESS (per-exercise history) ---------- */
  // is this exercise tracked by weight (any logged kg) or by reps?
  function seriesIsWeighted(series) {
    return series.some(function (p) { return p.weight != null && p.weight > 0; });
  }

  function seriesChart(series, weighted) {
    const key = weighted ? 'weight' : 'value';
    const vals = series.map(function (p) { return weighted ? (p.weight || 0) : p.value; });
    const W = 640, H = 180, P = { l: 40, r: 14, t: 14, b: 22 };
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const lo = min === max ? min - 1 : min, hi = min === max ? max + 1 : max;
    const t0 = new Date(series[0].date).getTime();
    const t1 = Math.max(new Date(series[series.length - 1].date).getTime(), t0 + 86400000);
    const x = function (d) { return P.l + (new Date(d).getTime() - t0) / (t1 - t0) * (W - P.l - P.r); };
    const y = function (v) { return P.t + (hi - v) / (hi - lo) * (H - P.t - P.b); };
    const pts = series.map(function (p) { return x(p.date).toFixed(1) + ',' + y(weighted ? (p.weight || 0) : p.value).toFixed(1); }).join(' ');
    const dots = series.map(function (p) { return `<circle cx="${x(p.date).toFixed(1)}" cy="${y(weighted ? (p.weight || 0) : p.value).toFixed(1)}" r="3" class="dot"/>`; }).join('');
    let grid = '';
    [lo, (lo + hi) / 2, hi].forEach(function (v) {
      grid += `<line x1="${P.l}" y1="${y(v)}" x2="${W - P.r}" y2="${y(v)}" class="grid"/><text x="${P.l - 6}" y="${(y(v) + 4).toFixed(1)}" class="axis">${Math.round(v * 10) / 10}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart spark" role="img">${grid}<polyline points="${pts}" class="avg"/>${dots}</svg>`;
  }

  function renderProgress() {
    const s = STORE.get();
    const tracked = STORE.trackedExercises(2);

    if (!tracked.length) {
      app.innerHTML = `
        <header class="pagehead"><h1>${esc(t('progress_title'))}</h1></header>
        <section class="card"><div class="hint">${esc(t('progress_empty'))}</div></section>
        <div class="stickybar"><button class="btn ghost" id="back">${esc(t('back'))}</button></div>`;
      $('#back').onclick = function () { nav('stats'); };
      return;
    }

    const cards = tracked.map(function (id) {
      const series = STORE.perfSeries(id);
      if (series.length < 2) return '';
      const weighted = seriesIsWeighted(series);
      const first = series[0], last = series[series.length - 1];
      const unit = weighted ? ' kg' : ' ' + t('reps');
      const a = weighted ? fmtKg(first.weight || 0) : first.value;
      const b = weighted ? fmtKg(last.weight || 0) : last.value;
      const delta = (weighted ? (last.weight || 0) - (first.weight || 0) : last.value - first.value);
      const deltaStr = (delta > 0 ? '+' : '') + (weighted ? fmtKg(delta) : delta);
      return `<section class="card">
        <div class="prow"><b class="pname">${esc(window.I18N.exName(EX[id]))}</b><span class="pdelta ${delta >= 0 ? 'up' : 'down'}">${esc(deltaStr + unit)}</span></div>
        <div class="hint">${esc(a + unit)} → ${esc(b + unit)} · ${series.length} ${esc(t('progress_points'))}</div>
        ${seriesChart(series, weighted)}
      </section>`;
    }).join('');

    app.innerHTML = `
      <header class="pagehead"><h1>${esc(t('progress_title'))}</h1></header>
      <div class="hint" style="margin-bottom:16px">${esc(t('progress_sub'))}</div>
      ${cards}
      <div class="stickybar"><button class="btn ghost" id="back">${esc(t('back'))}</button></div>`;
    $('#back').onclick = function () { nav('stats'); };
  }

  /* ---------- weekly recap card (shareable image) ---------- */
  function shareRecap() {
    const s = STORE.get();
    const cutoff = STORE.todayStr();
    const from = (function () { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
    const inWeek = function (dt) { return dt >= from && dt <= cutoff; };
    const sessions = s.history.filter(function (x) { return inWeek(x.date); });
    const rides = (s.rides || []).filter(function (r) { return inWeek(r.date); });
    const kg = sessions.reduce(function (a, x) { return a + (x.volume || 0); }, 0);
    const sober = STORE.soberStatus();
    const lvl = GAME.levelInfo(s.xp || 0);
    const lastW = s.weights[s.weights.length - 1];
    const lang = window.I18N.getLang();

    const C = document.createElement('canvas');
    C.width = 1080; C.height = 1080;
    const g = C.getContext('2d');
    const col = { orange: '#fc5200', ink: '#000', linen: '#f9f8f5', pewter: '#64635e', bone: '#e0e0de' };
    g.fillStyle = col.linen; g.fillRect(0, 0, 1080, 1080);
    g.fillStyle = col.orange; g.fillRect(0, 0, 1080, 20);

    g.fillStyle = col.orange;
    g.font = '700 96px "Source Sans 3", sans-serif';
    g.textBaseline = 'top';
    g.fillText('SPIEZZO', 80, 90);
    g.fillStyle = col.pewter;
    g.font = '400 34px "Source Sans 3", sans-serif';
    g.fillText(t('recap_week').toUpperCase(), 82, 210);

    // stat grid
    const stats = [
      [String(sessions.length), t('recap_sessions')],
      [String(rides.length) + ' 🚵', t('recap_rides')],
      [Math.round(kg).toLocaleString() + ' kg', t('recap_volume')],
      [String(sober.current), t('recap_sober')],
    ];
    const cellW = 460, cellH = 200, x0 = 80, y0 = 320, gap = 40;
    stats.forEach(function (st, i) {
      const cx = x0 + (i % 2) * (cellW + gap);
      const cy = y0 + Math.floor(i / 2) * (cellH + gap);
      g.fillStyle = '#fff'; g.fillRect(cx, cy, cellW, cellH);
      g.strokeStyle = col.bone; g.lineWidth = 2; g.strokeRect(cx, cy, cellW, cellH);
      g.fillStyle = col.ink; g.font = '700 84px "Source Sans 3", sans-serif';
      g.fillText(st[0], cx + 28, cy + 34);
      g.fillStyle = col.pewter; g.font = '600 26px "Source Sans 3", sans-serif';
      g.fillText(st[1].toUpperCase(), cx + 28, cy + 138);
    });

    // rank + weight line
    g.fillStyle = col.ink; g.font = '600 34px "Source Sans 3", sans-serif';
    let line = t('level') + ' ' + lvl.n + ' — ' + lvl.name + ' · ₽ ' + (s.xp || 0).toLocaleString();
    if (lastW) line += '  ·  ' + fmtKg(lastW.kg) + ' kg';
    g.fillText(line, 82, 800);

    // Drago verdict
    const verdict = GAME.phrase(sessions.length + rides.length >= 3 ? 'done' : 'greet_train');
    g.fillStyle = col.orange; g.font = 'italic 700 40px "Source Sans 3", sans-serif';
    wrapText(g, '“' + verdict + '”', 82, 880, 920, 52);

    g.fillStyle = col.pewter; g.font = '400 26px "Source Sans 3", sans-serif';
    g.fillText('spiezzo · ' + (lang === 'it' ? 'il disagio è compreso nel prezzo' : 'discomfort included, free of charge'), 82, 1010);

    // rasterize the mascot on top, then finish (xmlns required for a standalone SVG image)
    const svg = GAME.mascot.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="242" ');
    const img = new Image();
    img.onload = function () { g.drawImage(img, 780, 60, 220, 242); finishRecap(C); };
    img.onerror = function () { finishRecap(C); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function wrapText(g, text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', yy = y;
    words.forEach(function (w) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; }
      else line = test;
    });
    if (line) g.fillText(line, x, yy);
  }

  function finishRecap(C) {
    C.toBlob(function (blob) {
      if (!blob) return;
      const file = new File([blob], 'spiezzo-' + STORE.todayStr() + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'SPIEZZO', text: t('recap_share_text') }).catch(function () {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    }, 'image/png');
  }

  /* ---------- SETTINGS ---------- */
  function renderSettings() {
    const s = STORE.get();
    const days = t('days_short');
    app.innerHTML = `
      <header class="pagehead"><h1>${esc(t('settings'))}</h1></header>
      <section class="card">
        <div class="kicker">${esc(t('settings_lang'))}</div>
        <div class="seg">
          <button data-lang="it" class="${s.lang === 'it' ? 'on' : ''}">Italiano</button>
          <button data-lang="en" class="${s.lang === 'en' ? 'on' : ''}">English</button>
        </div>
      </section>
      <section class="card">
        <label class="switchrow">${esc(t('settings_sound'))}<input type="checkbox" id="sound" ${s.sound ? 'checked' : ''}></label>
        <label class="switchrow">${esc(t('settings_vibrate'))}<input type="checkbox" id="vibrate" ${s.vibrate ? 'checked' : ''}></label>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('settings_days'))}</div>
        <div class="days">${days.map(function (d, i) {
          return `<button data-day="${i}" class="${s.trainDays.indexOf(i) !== -1 ? 'on' : ''}">${esc(d)}</button>`;
        }).join('')}</div>
        <label class="switchrow">${esc(t('settings_reminder'))}<input type="checkbox" id="reminders" ${s.reminders ? 'checked' : ''}></label>
        <div class="hint">${esc(t('settings_reminder_note'))}</div>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('settings_profile'))}</div>
        <label class="lbl">${esc(t('setup_start'))}
          <input type="number" step="0.1" min="30" max="250" inputmode="decimal" id="profstart" value="${s.profile.startWeight != null ? s.profile.startWeight : ''}">
        </label>
        <label class="lbl">${esc(t('setup_goal'))}
          <input type="number" step="0.1" min="30" max="250" inputmode="decimal" id="profgoal" value="${s.profile.targetWeight != null ? s.profile.targetWeight : ''}">
        </label>
      </section>
      <section class="card">
        <div class="kicker">${esc(t('settings_sync'))}</div>
        <label class="lbl">${esc(t('settings_sync_url'))}
          <input type="url" id="sheeturl" placeholder="${esc(t('settings_sync_url_ph'))}" value="${esc(s.sheetUrl || '')}">
        </label>
        <button class="btn" id="syncnow">${esc(t('settings_sync_now'))}</button>
        <button class="btn ghost" id="pullnow">${esc(t('settings_pull'))}</button>
        <div class="hint">${esc(t('settings_sync_last'))}: ${s.lastSync ? new Date(s.lastSync).toLocaleString() : esc(t('settings_sync_never'))} · <span id="syncmsg"></span></div>
        <div class="hint">${esc(t('settings_pull_help'))}</div>
        <div class="hint">${esc(t('settings_sync_help'))}</div>
      </section>
      ${s.custom ? `<section class="card">
        <div class="kicker">${esc(t('settings_custom'))}</div>
        <button class="btn ghost" id="clearcustom">${esc(t('settings_custom_clear'))}</button>
      </section>` : ''}
      <section class="card">
        <button class="btn ghost" id="export">${esc(t('settings_export'))}</button>
        <button class="btn ghost" id="importbtn">${esc(t('settings_import'))}</button>
        <input type="file" id="importfile" accept=".json,application/json" hidden>
        <button class="btn ghost" id="install" hidden>${esc(t('settings_install'))}</button>
      </section>
      <div class="footer">SPIEZZO · ${esc(t('offline_ready'))} · <a href="https://github.com/sgelob/spiezzo" target="_blank" rel="noopener">GitHub</a></div>`;

    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.onclick = function () {
        STORE.set({ lang: b.dataset.lang });
        window.I18N.setLang(b.dataset.lang);
        render();
      };
    });
    $('#sound').onchange = function () { STORE.set({ sound: this.checked }); };
    $('#vibrate').onchange = function () { STORE.set({ vibrate: this.checked }); };
    document.querySelectorAll('[data-day]').forEach(function (b) {
      b.onclick = function () {
        const d = +b.dataset.day;
        const td = STORE.get().trainDays.slice();
        const i = td.indexOf(d);
        if (i === -1) td.push(d); else td.splice(i, 1);
        td.sort();
        STORE.set({ trainDays: td });
        render();
      };
    });
    $('#reminders').onchange = function () {
      const el = this;
      if (el.checked && 'Notification' in window) {
        Notification.requestPermission().then(function (p) {
          STORE.set({ reminders: p === 'granted' });
          if (p !== 'granted') el.checked = false;
        });
      } else {
        STORE.set({ reminders: false });
      }
    };
    ['profstart', 'profgoal'].forEach(function (id) {
      $('#' + id).onchange = function () {
        const v = parseFloat(String(this.value).replace(',', '.'));
        if (!v || v < 30 || v > 250) return;
        const p = Object.assign({}, STORE.get().profile);
        p[id === 'profstart' ? 'startWeight' : 'targetWeight'] = v;
        STORE.set({ profile: p });
      };
    });
    $('#sheeturl').onchange = function () { STORE.set({ sheetUrl: this.value.trim() }); };
    $('#syncnow').onclick = function () {
      const msg = $('#syncmsg');
      STORE.set({ sheetUrl: $('#sheeturl').value.trim() });
      msg.textContent = '…';
      STORE.sync().then(function () { msg.textContent = t('settings_sync_ok'); render(); })
        .catch(function () { msg.textContent = t('settings_sync_err'); });
    };
    $('#pullnow').onclick = function () {
      const msg = $('#syncmsg');
      STORE.set({ sheetUrl: $('#sheeturl').value.trim() });
      if (!confirm(t('settings_pull_confirm'))) return;
      msg.textContent = '…';
      STORE.pull().then(function () {
        window.I18N.setLang(STORE.get().lang);
        render();
      }).catch(function () { msg.textContent = t('settings_pull_err'); });
    };
    if (s.custom) $('#clearcustom').onclick = function () { STORE.clearCustom(); render(); };
    $('#export').onclick = function () {
      const blob = new Blob([STORE.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'spiezzo-backup-' + STORE.todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      STORE.setLastExport();
    };
    $('#importbtn').onclick = function () { $('#importfile').click(); };
    $('#importfile').onchange = function () {
      const f = this.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        if (confirm(t('settings_import_confirm'))) {
          STORE.importJSON(txt);
          window.I18N.setLang(STORE.get().lang);
          render();
        }
      }).catch(function () { alert(t('settings_sync_err')); });
    };
    if (window.deferredInstall) {
      const btn = $('#install');
      btn.hidden = false;
      btn.onclick = function () {
        window.deferredInstall.prompt();
        window.deferredInstall = null;
        btn.hidden = true;
      };
    }
  }

  function bindNavData() {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.onclick = function () { nav(el.dataset.nav); };
    });
  }

  /* ---------- reminders (best effort, on open) ---------- */
  function maybeNotify() {
    const s = STORE.get();
    if (!s.reminders || !('Notification' in window) || Notification.permission !== 'granted') return;
    const dow = (new Date().getDay() + 6) % 7;
    if (s.trainDays.indexOf(dow) === -1) return;
    const today = STORE.todayStr();
    if (s.history.some(function (x) { return x.date === today; })) return;
    if (localStorage.getItem('spiezzo.notified') === today) return;
    localStorage.setItem('spiezzo.notified', today);
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(t('notif_title'), { body: t('notif_body'), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
      }).catch(function () {});
    }
  }

  /* ---------- boot ---------- */
  // ask the browser to keep our localStorage durable (avoid eviction of streaks/history)
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(function (already) {
      if (!already) navigator.storage.persist().catch(function () {});
    }).catch(function () {});
  }
  window.I18N.setLang(STORE.get().lang);
  document.querySelectorAll('.nav button').forEach(function (b) {
    b.addEventListener('click', function () { nav(b.dataset.view); });
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.deferredInstall = e;
  });
  render();
  maybeNotify();
  STORE.maybeAutoSync();
})();
