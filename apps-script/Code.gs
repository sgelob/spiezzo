/**
 * SPIEZZO — Google Sheet sync endpoint (Google Apps Script).
 *
 * Receives POSTs from the app and upserts rows into these sheets:
 *   "Peso"     — date | kg
 *   "Sessioni" — id | date | session | minutes | volume
 *   "Giri"     — id | date | minutes            (MTB rides)
 *   "Backup"   — a single JSON snapshot cell, for full device migration
 *
 * doGet(?backup=1) returns that snapshot so a new device can restore everything.
 *
 * Optional: run installReminderTrigger() once to get a daily e-mail nudge on
 * your training days (reads trainDays synced from the app). See GOOGLE_SHEETS.md.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var wSheet = getSheet(ss, 'Peso', ['date', 'kg']);
    upsert(wSheet, data.weights || [], 'date', function (w) { return [w.date, w.kg]; });

    var sSheet = getSheet(ss, 'Sessioni', ['id', 'date', 'session', 'minutes', 'volume']);
    upsert(sSheet, data.sessions || [], 'id', function (s) {
      return [s.id, s.date, s.session, s.minutes, s.volume];
    });

    var rSheet = getSheet(ss, 'Giri', ['id', 'date', 'minutes']);
    upsert(rSheet, data.rides || [], 'id', function (r) { return [r.id, r.date, r.minutes]; });

    if (data.backup) {
      var bSheet = getSheet(ss, 'Backup', ['snapshot', 'updated']);
      bSheet.getRange(2, 1, 1, 2).setValues([[data.backup, new Date().toISOString()]]);
    }
    if (data.config) {
      PropertiesService.getScriptProperties().setProperty('config', JSON.stringify(data.config));
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.backup) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var bSheet = ss.getSheetByName('Backup');
    var snapshot = null, updated = null;
    if (bSheet && bSheet.getLastRow() >= 2) {
      var row = bSheet.getRange(2, 1, 1, 2).getValues()[0];
      snapshot = row[0] || null;
      updated = row[1] || null;
    }
    return json({ ok: true, backup: snapshot, updated: updated });
  }
  return json({ ok: true, app: 'spiezzo-sync' });
}

function getSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsert(sh, records, keyField, toRow) {
  if (!records.length) return;
  var last = sh.getLastRow();
  var existing = {};
  if (last > 1) {
    var keys = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) existing[String(keys[i][0])] = i + 2;
  }
  records.forEach(function (rec) {
    var row = toRow(rec);
    var at = existing[String(rec[keyField])];
    if (at) {
      sh.getRange(at, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- optional daily e-mail reminder (zero extra servers) ----------
   Run installReminderTrigger() once from the Apps Script editor to schedule a
   daily check at ~08:00. It e-mails you only on your chosen training days when
   you haven't logged a session yet that day. trainDays come from the app's sync
   payload (0=Mon … 6=Sun). */

function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'sendReminderIfTrainingDay') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('sendReminderIfTrainingDay').timeBased().atHour(8).everyDays(1).create();
}

function sendReminderIfTrainingDay() {
  var cfgRaw = PropertiesService.getScriptProperties().getProperty('config');
  var cfg = cfgRaw ? JSON.parse(cfgRaw) : { trainDays: [1, 4] };
  var days = cfg.trainDays || [1, 4];
  var now = new Date();
  var dow = (now.getDay() + 6) % 7;                 // 0=Mon … 6=Sun
  if (days.indexOf(dow) === -1) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Sessioni');
  var today = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  if (sh && sh.getLastRow() > 1) {
    var dates = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      if (String(dates[i][0]).slice(0, 10) === today) return;  // already trained today
    }
  }
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'SPIEZZO',
    'Oggi tocca a te. Il disagio non si fa da solo. / Today it\'s on you. The pain won\'t make itself.');
}
