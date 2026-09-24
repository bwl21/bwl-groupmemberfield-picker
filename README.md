# ChurchTools Gruppenmitgliedsfelder-Picker

Eine ChurchTools-Extension zum Übernehmen von Gruppenmitgliedsfeld-Definitionen aus mehreren Quellgruppen in eine Zielgruppe. Aktuelle Version: **0.1.0**.

Die Anwendung legt Felddefinitionen an; sie kopiert keine Mitgliedschaften oder ausgefüllten Feldwerte von Personen.

## Bedienung

1. **Zielgruppe auswählen.** Die Gruppe muss das benutzerdefinierte Gruppenfeld `bwl_gmfp_config` besitzen. Darin wird die Auswahl gespeichert. Ein Aufruf mit `?groupId=123` oder `?group=123` kann die Zielgruppe vorwählen.
2. **Quellgruppen hinzufügen.** „Quellgruppe hinzufügen“ öffnet die Suche. Ausgewählte Gruppen erscheinen als kompakte Chips. Nach dem Hinzufügen schließt sich die Suche. Das × entfernt eine Gruppe und wählt deren Felder ab; dauerhaft gespeichert wird diese Änderung erst mit „Auswahl speichern“.
3. **Felder auswählen.** Die Felder sind nach Quellgruppe gegliedert. „ⓘ Felddetails“ zeigt unter anderem Beschreibung, Standardwert, Auswahloptionen, Sicherheitslevel und Anmeldeeinstellungen. Mehrere Detailansichten können zum Vergleichen geöffnet bleiben.
4. **Auswahl speichern oder Felder anlegen.** „Auswahl speichern“ speichert alle Quellgruppen und Feldzuordnungen, ohne Felder anzulegen. Der Anlegen-Button nennt die Zahl der anzulegenden Felder und ihrer Quellgruppen. Vor dem Anlegen zeigt eine Bestätigung Zielgruppe sowie Feldnamen mit ihrer jeweiligen Quellgruppe.

Bereits in der Zielgruppe vorhandene Referenznamen werden nicht erneut angelegt. Haben mehrere ausgewählte Quellfelder denselben Referenznamen, muss zunächst eines davon ausgewählt und die übrigen abgewählt werden. Ohne anlegbare Felder ist der Anlegen-Button deaktiviert.

Nicht verfügbare Quellgruppen und gespeicherte, inzwischen fehlende Felder bleiben als Hinweis sichtbar. Sie werden nicht angelegt und können aus der Auswahl entfernt werden. Bei Ladefehlern kann eine Quellgruppe separat erneut geladen werden.

Die Felddetails zeigen die Quelldefinition. Beim Anlegen werden derzeit Name, Feldtyp, Beschreibung, Standardwert, Optionen, Sicherheitslevel, Verwendung und Pflichtstatus im Anmeldeformular sowie Sortierung übertragen. Zusätzliche Details wie maximale Länge und gesonderte Anmeldeformulartexte werden angezeigt, aber derzeit nicht übertragen.

## Gespeicherte Auswahlen und Kompatibilität

Bestehende Konfigurationen im bisherigen kompakten oder vollständigen JSON-Format können ohne Migration geladen werden. Jede gespeicherte Feldzuordnung enthält bereits Quellgruppen-ID und Feld-ID; Version 0.1.0 stellt alle enthaltenen Quellgruppen wieder her.

Für Quellgruppen ohne ausgewählte Felder ergänzt das kompakte Format optional `g`, eine Liste von Gruppen-IDs. Die bisherige Feldliste `s` bleibt unverändert. Ältere Versionen berücksichtigen diese zusätzliche Gruppenliste nicht und erhalten Gruppen ohne Feldauswahl beim erneuten Speichern nicht.

Das bestehende Speicherlimit von **1000 Zeichen** gilt weiterhin. Eine zu große Auswahl wird beim Speichern mit einem Fehler gemeldet.

## Lokale Entwicklung

Voraussetzungen: Node.js **22.18 oder neuer** und npm. Die lokalen Tests verwenden Nodes Unterstützung für TypeScript-Dateien.

```bash
npm install
npm run dev
```

Der Entwicklungsserver verwendet Port 5173. Die Verbindung zu ChurchTools muss für die jeweilige Entwicklungsumgebung eingerichtet sein; ein lokaler Serverstart allein ersetzt keine Anmeldung oder API-Berechtigung.

### Konfiguration

Die vorhandene Vite-Konfiguration lädt lokale `.env`-Dateien. Folgende Einstellungen werden im Quellcode verwendet:

| Einstellung | Verwendung |
| --- | --- |
| `VITE_KEY` | Öffentlicher Extension-Key; bestimmt den Asset-Pfad `/ccm/<key>/`. |
| `VITE_CHURCHTOOLS_URL` | Basis-URL der ChurchTools-Instanz. |
| `VITE_BASE_URL` | Alternativer Basis-URL-Wert. |
| `window.settings.base_url` | Zur Laufzeit bereitgestellte Basis-URL; hat Vorrang vor den Build-Werten. |

Der Entwicklungseinstieg unterstützt außerdem einen automatischen Login mit `VITE_USERNAME` und `VITE_PASSWORD`. Zugangsdaten gehören nicht in Repository oder Release-Artefakte. Die Tests benötigen keine Zugangsdaten und greifen nicht auf ChurchTools zu.

### Tests und Build

```bash
npm test
npm run build
```

Die Tests verwenden synthetische Daten und ersetzen API-Aufrufe durch lokale Testfunktionen. Sie prüfen unter anderem Mehrfachauswahl, Laden alter Konfigurationen, Gruppenzuordnung gleichlautender Feld-IDs, Referenzkonflikte und Ladefehler. Der Build erzeugt `dist/`.

## Release erstellen

```bash
npm run deploy
```

Der Release-Build lädt keine `.env`-Dateien und übernimmt keine `VITE_`-Umgebungsvariablen. Er verwendet den öffentlichen Extension-Key `bwl-groupmemberfield-picker`. Als API-Basis dient `window.settings.base_url`, sofern bereitgestellt, ansonsten der Ursprung der installierten Extension (`window.location.origin`). Eine Anmeldung erfolgt über die vorhandene ChurchTools-Sitzung.

Trotz des Namens veröffentlicht dieser Befehl nichts: Er baut die Anwendung und erstellt mit `scripts/package.js` ein ZIP unter `releases/`:

```text
bwl-groupmemberfield-picker-v<VERSION>-<GIT-COMMIT>.zip
```

Das Archiv enthält `dist/`; Source Maps werden ausgeschlossen. Der Upload und die Installation in ChurchTools erfolgen separat und manuell. Für ein reproduzierbares Release sollten die Änderungen vor der Paketierung committed sein.

## Änderungen in 0.1.0

- Mehrere Quellgruppen gleichzeitig auswählen und wiederherstellen.
- Kompakte Gruppen-Chips mit einklappbarer Suche.
- Nach Quellgruppe gegliederte Feldauswahl mit aufklappbaren Details.
- Korrekte Zuordnung und Zählung der anzulegenden Felder; Schutz vor mehrdeutigen Referenznamen.
- Sichtbare Hinweise auf fehlende Gruppen und Felder sowie erneutes Laden nach Fehlern.
- Lokale Regressionstests für Auswahl und Speicherkompatibilität.

## Weitere Dokumentation

Das [Konzeptdokument](docs/KONZEPT.md) beschreibt den ursprünglichen Entwurf. Für das aktuelle Bedienverhalten ist diese README maßgeblich.
