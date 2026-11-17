/**
 * Respaldo semanal de Kaffa Love en Google Drive (docs/PRODUCCION.md, 7.4).
 *
 * Se pega en https://script.google.com con la cuenta de Google de la tienda.
 * 1. En Configuración del proyecto → Propiedades del script, agrega BACKUP_SECRET
 *    (el mismo valor que en Vercel).
 * 2. Ejecuta una vez la función "instalar": autoriza el acceso a Drive y deja
 *    programado el respaldo cada lunes a las 4:00. También hace el primer respaldo.
 *
 * Guarda los respaldos comprimidos en la carpeta "Respaldos Kaffa Love" y conserva
 * los últimos 12. Si un respaldo falla, Google envía un correo a esta cuenta.
 */
var URL_RESPALDO = "https://kaffalove.cl/api/respaldo";
var CARPETA = "Respaldos Kaffa Love";
var CONSERVAR = 12;

function respaldar() {
  var secret = PropertiesService.getScriptProperties().getProperty("BACKUP_SECRET");
  if (!secret) throw new Error("Falta BACKUP_SECRET en las propiedades del script.");

  var res = UrlFetchApp.fetch(URL_RESPALDO, {
    headers: { Authorization: "Bearer " + secret },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error("El respaldo respondió " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200));
  }
  var text = res.getContentText("UTF-8");
  var data = JSON.parse(text);
  if (!data.tables || !data.tables.products || !data.tables.products.length) {
    throw new Error("El respaldo vino incompleto (sin productos).");
  }

  var fecha = Utilities.formatDate(new Date(), "America/Santiago", "yyyy-MM-dd");
  var nombre = "kaffa-love-" + fecha + ".json";
  var blob = Utilities.newBlob(text, "application/json", nombre);
  carpeta_().createFile(Utilities.gzip(blob, nombre + ".gz"));
  limpiar_();
}

function carpeta_() {
  var it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}

/** Deja solo los últimos CONSERVAR respaldos */
function limpiar_() {
  var files = [];
  var it = carpeta_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (/^kaffa-love-.*\.json\.gz$/.test(f.getName())) files.push(f);
  }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(CONSERVAR).forEach(function (f) { f.setTrashed(true); });
}

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "respaldar") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("respaldar").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).inTimezone("America/Santiago").create();
  respaldar();
}
