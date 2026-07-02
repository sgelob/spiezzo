# SPIEZZO ⇄ Google Sheet sync — setup in 10 minutes

The app works fully offline with data in your browser (localStorage).
The Google Sheet is an **optional backup + analysis view**: the app pushes your
weigh-ins and completed sessions to a Sheet on your Google account through a
tiny Apps Script "web app" that only you own.

## Setup

1. **Create the Sheet**
   Go to [sheets.new](https://sheets.new) and name it e.g. `SPIEZZO`.

2. **Open the script editor**
   In the Sheet: **Estensioni → Apps Script** (Extensions → Apps Script).

3. **Paste the code**
   Delete the default content of `Code.gs` and paste the full contents of
   [`apps-script/Code.gs`](apps-script/Code.gs) from this repo. Save (💾).

4. **Deploy as web app**
   - Click **Esegui il deployment → Nuovo deployment** (Deploy → New deployment)
   - Type: **App web** (Web app)
   - *Esegui come / Execute as*: **Me**
   - *Chi può accedere / Who has access*: **Chiunque / Anyone**
     (the URL is an unguessable secret; the script can only write to this one Sheet)
   - Click **Deployment**, authorize with your Google account when asked.

5. **Copy the URL**
   Copy the web app URL (`https://script.google.com/macros/s/…/exec`).

6. **Paste it into SPIEZZO**
   App → ⚙ Impostazioni → *Sync Google Sheet* → paste the URL → **SINCRONIZZA ORA**.

Two tabs appear in your Sheet:

| Sheet | Columns |
|---|---|
| `Peso` | date, kg |
| `Sessioni` | id, date, session, minutes, volume |

## Notes

- Sync is **one-way** (app → Sheet) and idempotent: rows are upserted by key,
  so syncing twice never duplicates data.
- The app auto-syncs after every workout/weigh-in when online; otherwise data
  waits locally and syncs on the next opportunity.
- If you redeploy the script, the URL changes — update it in the app settings.
- Full local backup is always available via ⚙ → *Esporta dati (JSON)*.
