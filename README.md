# SPIEZZO 🚵‍💥

> **Ti spiezzo in due ruote.** Il disagio è compreso nel prezzo.

An installable **PWA** for home strength circuits that support weekly
MTB riding and weight loss. 1–2 sessions a week, under an hour, minimal gear
(dumbbells, barbell, TRX, gym ball, bench), zero servers.

**Live app:** https://sgelob.github.io/spiezzo/

## What it does

- **Session A / B metabolic circuits** — full-body, ~50 min including warm-up
  and cool-down. A = push & legs, B = pull & posterior chain. Built-in
  progression: the app remembers your last numbers and asks for +1 rep, then
  +2.5 kg when you hit the top of the range.
- **🎲 A CASO** — generates a balanced random circuit (quad / push / hinge /
  pull / core / cardio) from ~800 exercises when you want variety. Like one?
  **Save it** as a reusable Session C with the same +1 rep progression.
- **Guided player** — step-by-step instructions (IT/EN), rest countdowns,
  beeps + vibration, screen wake-lock, progress bar. **Swap** any exercise
  mid-session for another that hits the same muscle when your gear is busy.
- **Comeback deload** — after a long layoff the app eases you back in with
  lighter targets instead of piling on where you left off.
- **🚵 Ride log** — one-tap MTB ride logging that feeds the weekly streak,
  earns rubli, and unlocks ride medals (the whole point is supporting riding).
- **Weight log** — you set your own starting and target weight (the "pact with
  discomfort"), then log quick weigh-ins: 7-day trend chart, goal line, pace
  feedback and projected goal date.
- **Stats & progress** — sessions, streaks (weeks in a row), rides, minutes of
  disagio, total kg lifted, plus **per-exercise progress charts** (watch your
  goblet squat climb week over week).
- **📸 Weekly recap** — a shareable, Strava-style image of your week (sessions,
  rides, kg lifted, sober days, Drago's verdict) via the Web Share API.
- **Offline-first** — full app + exercise data cached by a service worker.
  Install it from the browser menu ("Add to Home Screen"). Requests durable
  storage so the browser won't evict your streaks.
- **Data** — lives in your browser (localStorage), exportable as JSON, with
  optional two-way sync to a **Google Sheet** ([setup guide](GOOGLE_SHEETS.md)):
  push everything up, and **restore onto a new device** by pulling it back.

## Stack

Plain HTML/CSS/JS. No framework, no build step, no dependencies. Hosted on
GitHub Pages.

```
index.html            app shell
css/app.css           warm-paper logbook look (Strava-inspired)
js/i18n.js            IT/EN strings
js/store.js           localStorage state + Sheet sync
js/program.js         sessions, progression, generator
js/ui.js              views + workout player + SVG chart
data/exercises.js     820 exercises (EN/IT), see attribution below
sw.js                 offline cache
apps-script/Code.gs   Google Sheet sync endpoint
```

## Exercise data attribution

Exercise data derives from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(base data from [ExerciseDB v1 by AscendAPI](https://oss.exercisedb.dev), via a
Kaggle re-host), filtered to home equipment, with custom TRX/warm-up entries
added. Exercise media is not included or used. For educational and personal use.

## Development

Any static server works:

```bash
python3 -m http.server 8080
```

Bump `VERSION` in `sw.js` when changing files, so installed clients pick up updates.
