/**
 * SPIEZZO — Google Sheet sync endpoint (Google Apps Script).
 *
 * Receives POSTs from the app and upserts rows into two sheets:
 *   "Peso"     — date | kg
 *   "Sessioni" — id | date | session | minutes | volume
 *
 * See GOOGLE_SHEETS.md in the repo for setup instructions.
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

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
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
