# Konzept: Gruppenmitgliedsfelder-Picker

## Übersicht

Eine ChurchTools-Extension zum Sammeln und Zusammenführen von Gruppenmitgliedsfeldern aus mehreren Quellgruppen in eine Zielgruppe. Die Anwendung liest Felder aus ausgewählten Quellgruppen und kopiert die Werte in ein entsprechendes Feld der Zielgruppe.

**Kernkonzept**: Die Extension erstellt **keine** neuen Felder, sondern nutzt bestehende Gruppenmitgliedsfelder. Die Konfiguration, welche Quellfelder in welches Zielfeld übernommen werden, wird in einem benutzerdefinierten Gruppenfeld (Custom Group Field) der Zielgruppe gespeichert.

## Anwendungsfall

**Szenario**: Eine Hauptgruppe (z.B. "Gesamtchor") hat mehrere Untergruppen (z.B. "Sopran", "Alt", "Tenor", "Bass"). Jede Untergruppe hat eigene Gruppenmitgliedsfelder (z.B. "Anwesenheit", "Noten erhalten"). Die Hauptgruppe soll diese Informationen zentral sammeln.

**Lösung**: Die Extension ermöglicht es, Felder aus den Untergruppen automatisch in entsprechende Felder der Hauptgruppe zu übertragen.

## Zielgruppe

- Gruppenleiter, die Informationen aus mehreren Untergruppen zentral sammeln müssen
- Administratoren, die Daten aus verschiedenen Gruppen konsolidieren wollen
- Personen mit Berechtigungen zum Zugriff auf Gruppenmitgliedsdaten

## Hauptfunktionen

### 1. Zielgruppe auswählen
- Auswahl der Gruppe, in die Daten übernommen werden sollen
- Anzeige der vorhandenen Gruppenmitgliedsfelder
- Prüfung, ob ein Konfigurationsfeld existiert

### 2. Konfigurationsfeld-Setup
- **Wichtig**: Die Extension erstellt keine Felder automatisch
- Anzeige einer Anleitung, welches **Gruppenfeld** (nicht Gruppenmitgliedsfeld!) manuell anzulegen ist:
  - **Name**: "Feldübernahme-Konfiguration" (oder frei wählbar)
  - **Typ**: Textarea (für JSON-Konfiguration)
  - **Hinweis**: Wird von der Extension zur Speicherung der Mapping-Konfiguration verwendet
  - **Wichtig**: Dies ist ein Custom Field der Gruppe selbst, nicht der Gruppenmitglieder
- Erkennung des Konfigurationsfeldes anhand des Namens oder einer Konvention

### 3. Quellgruppen und Feldmapping
- Auswahl von Quellgruppen (Untergruppen)
- Anzeige der Gruppenmitgliedsfelder jeder Quellgruppe
- Mapping-Konfiguration:
  - Welches Quellfeld → Welches Zielfeld
  - Mehrere Quellfelder können in dasselbe Zielfeld übernommen werden
  - Konfliktauflösung (z.B. "Überschreiben", "Nur wenn leer", "Priorisierung")

### 4. Datenübernahme
- Manuelle Ausführung der Datenübernahme
- Anzeige des Fortschritts
- Protokollierung von Fehlern und Warnungen
- Vorschau vor der Übernahme (optional)

### 5. Konfigurationsverwaltung
- Speicherung der Mapping-Konfiguration im Konfigurationsfeld der Zielgruppe
- Laden der gespeicherten Konfiguration beim nächsten Aufruf
- Bearbeitung und Aktualisierung der Konfiguration

## Technische Architektur

### Frontend-Stack
- **Framework**: Vanilla TypeScript mit Vite
- **UI-Bibliothek**: PrimeVue 4.x
  - DataTable für Tabellenansicht
  - MultiSelect für Feld- und Gruppenauswahl
  - Button, Dialog, ProgressBar für UI-Elemente
  - Toast für Benachrichtigungen
- **API-Client**: @churchtools/churchtools-client
- **Build-Tool**: Vite

### Datenmodell

#### Mapping-Konfiguration (gespeichert im Gruppenmitgliedsfeld)
```typescript
interface FieldMappingConfiguration {
  version: string;                    // Konfigurationsversion (z.B. "1.0")
  targetGroupId: number;              // ID der Zielgruppe
  mappings: FieldMapping[];           // Array von Feld-Mappings
  conflictResolution: ConflictStrategy; // Strategie bei Konflikten
  lastUpdated: string;                // ISO-Datum der letzten Aktualisierung
}

interface FieldMapping {
  targetFieldId: number;              // ID des Zielfeldes
  targetFieldName: string;            // Name des Zielfeldes (zur Anzeige)
  sources: SourceFieldConfig[];       // Quellfelder (priorisiert)
}

interface SourceFieldConfig {
  groupId: number;                    // ID der Quellgruppe
  groupName: string;                  // Name der Quellgruppe (zur Anzeige)
  fieldId: number;                    // ID des Quellfeldes
  fieldName: string;                  // Name des Quellfeldes (zur Anzeige)
  priority: number;                   // Priorität (1 = höchste)
}

type ConflictStrategy = 
  | 'overwrite'                       // Immer überschreiben
  | 'keep-existing'                   // Nur wenn Zielfeld leer
  | 'priority';                       // Nach Priorität der Quellen

// Beispiel einer gespeicherten Konfiguration:
const exampleConfig: FieldMappingConfiguration = {
  version: "1.0",
  targetGroupId: 100,
  conflictResolution: "priority",
  lastUpdated: "2025-01-07T14:30:00Z",
  mappings: [
    {
      targetFieldId: 501,
      targetFieldName: "Anwesenheit",
      sources: [
        {
          groupId: 101,
          groupName: "Sopran",
          fieldId: 201,
          fieldName: "Anwesenheit",
          priority: 1
        },
        {
          groupId: 102,
          groupName: "Alt",
          fieldId: 202,
          fieldName: "Anwesenheit",
          priority: 2
        }
      ]
    }
  ]
};
```

#### Konfigurationsfeld-Konvention

Das Konfigurationsfeld ist ein **Custom Group Field** (benutzerdefiniertes Gruppenfeld), das in der Zielgruppe angelegt werden muss:

- **Typ**: `textarea` (für JSON-Speicherung)
- **Name**: Enthält "config" oder "konfiguration" (case-insensitive)
- **Referenzname**: z.B. `field_mapping_config`
- **Inhalt**: JSON-String der `FieldMappingConfiguration`
- **Speicherort**: Direkt auf der Gruppe (nicht bei den Gruppenmitgliedern)

Die Extension erkennt das Konfigurationsfeld automatisch anhand des Namens.

**Unterschied zu Gruppenmitgliedsfeldern:**
- **Gruppenfeld (Group Custom Field)**: Gehört zur Gruppe selbst (z.B. "Beschreibung", "Budget") → Hier wird die Konfiguration gespeichert
- **Gruppenmitgliedsfeld (Group Member Field)**: Gehört zu jedem Mitglied der Gruppe (z.B. "Anwesenheit", "Rolle") → Hier werden die Daten gesammelt

### ChurchTools API-Endpunkte

Verwendete API-Endpunkte:

**Gruppen:**
- `GET /groups` - Gruppenliste abrufen
- `GET /groups/{groupId}` - Gruppendetails inkl. Custom Group Fields abrufen
- `PATCH /groups/{groupId}` - Gruppe aktualisieren (inkl. Custom Group Fields)

**Gruppenmitglieder:**
- `GET /groups/{groupId}/members` - Gruppenmitglieder abrufen

**Gruppenmitgliedsfelder:**
- `GET /groups/{groupId}/memberfields` - Alle Gruppenmitgliedsfelder abrufen
- `PATCH /groups/{groupId}/members/{personId}` - Gruppenmitgliedsfeld-Werte aktualisieren

**Konfigurationsspeicherung (optional):**
- `GET /custommodules/{moduleId}/customdatacategories` - Extension-Einstellungen
- `POST /custommodules/{moduleId}/customdatacategories` - Extension-Einstellungen speichern

### Datenspeicherung

**Primäre Speicherung**: Custom Group Field der Zielgruppe
- Die Mapping-Konfiguration wird als JSON im Gruppenfeld gespeichert
- Vorteil: Konfiguration ist direkt mit der Gruppe verknüpft
- Vorteil: Konfiguration ist unabhängig von einzelnen Mitgliedern
- Zugriff: Über `GET /groups/{groupId}` (Custom Fields sind im Root-Level des Group-Objekts)
- Update: Über `PATCH /groups/{groupId}` mit dem Custom Field als Property

**Optionale Speicherung**: ChurchTools Key-Value-Store (für Extension-weite Einstellungen)

**Kategorie: `settings`**
- Benutzereinstellungen (z.B. Standard-Konfliktauflösung)
- Zuletzt verwendete Zielgruppe
- UI-Präferenzen

## Workflow

### 1. Erstmalige Einrichtung

```
1. Benutzer wählt Zielgruppe aus
   ↓
2. Extension prüft, ob Konfigurationsfeld existiert
   ↓
3a. Feld existiert → Konfiguration laden
3b. Feld existiert nicht → Anleitung anzeigen:
    
    ┌─────────────────────────────────────────────┐
    │ ⚠️  Konfigurationsfeld fehlt                │
    │                                             │
    │ Bitte legen Sie folgendes GRUPPENFELD      │
    │ (nicht Gruppenmitgliedsfeld!) manuell an:  │
    │                                             │
    │ Name: Feldübernahme-Konfiguration          │
    │ Typ: Textarea                               │
    │ Referenzname: field_mapping_config          │
    │                                             │
    │ Ort: Stammdaten → Gruppen → Felder         │
    │      (Custom Group Fields)                  │
    │                                             │
    │ [Anleitung kopieren] [Zur Gruppe wechseln] │
    └─────────────────────────────────────────────┘
```

### 2. Mapping konfigurieren

```
1. Quellgruppen auswählen (MultiSelect)
   ↓
2. Für jedes Zielfeld:
   - Quellfelder aus verschiedenen Gruppen zuordnen
   - Priorität festlegen
   ↓
3. Konfliktauflösung wählen
   ↓
4. Konfiguration speichern (im Konfigurationsfeld)
```

### 3. Daten übernehmen

```
1. Konfiguration laden
   ↓
2. Für jedes Mitglied der Zielgruppe:
   - Prüfen, ob Person in Quellgruppen ist
   - Werte aus Quellfeldern lesen
   - Nach Priorität/Strategie zusammenführen
   - In Zielfeld schreiben
   ↓
3. Protokoll anzeigen (Erfolge/Fehler)
```

## UI-Komponenten (PrimeVue)

### Hauptansicht
```
┌─────────────────────────────────────────────────────────┐
│ Gruppenmitgliedsfelder zusammensammeln                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Schritt 1: Zielgruppe                                   │
│ [Zielgruppe auswählen ▼]                               │
│ ✅ Konfigurationsfeld gefunden: "field_mapping_config" │
│                                                         │
│ Schritt 2: Quellgruppen                                 │
│ [Quellgruppen auswählen (mehrfach) ▼]                  │
│ Ausgewählt: Sopran, Alt, Tenor                         │
│                                                         │
│ Schritt 3: Feldmapping                                  │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Zielfeld: Anwesenheit                             │ │
│ │ ┌─────────────────────────────────────────────┐   │ │
│ │ │ Prio │ Quellgruppe │ Quellfeld      │ [×]  │   │ │
│ │ ├──────┼─────────────┼────────────────┼──────┤   │ │
│ │ │  1   │ Sopran      │ Anwesenheit    │ [×]  │   │ │
│ │ │  2   │ Alt         │ Anwesenheit    │ [×]  │   │ │
│ │ └─────────────────────────────────────────────┘   │ │
│ │ [+ Quelle hinzufügen]                             │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ Konfliktauflösung: ⦿ Nach Priorität                    │
│                     ○ Überschreiben                     │
│                     ○ Nur wenn leer                     │
│                                                         │
│ [Vorschau] [Konfiguration speichern] [Jetzt übernehmen]│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### PrimeVue-Komponenten
1. **Dropdown**: Zielgruppen-Auswahl
2. **MultiSelect**: Quellgruppen-Auswahl
3. **DataTable**: Mapping-Konfiguration, Vorschau
4. **RadioButton**: Konfliktauflösungs-Strategie
5. **Button**: Aktionen (Speichern, Übernehmen, Vorschau)
6. **Dialog**: Anleitung für Konfigurationsfeld, Bestätigungen
7. **ProgressBar**: Fortschritt bei Datenübernahme
8. **Toast**: Erfolgs- und Fehlermeldungen
9. **Card/Panel**: Gruppierung der Schritte
10. **Message**: Hinweise und Warnungen

## Berechtigungen

Erforderliche ChurchTools-Berechtigungen:
- Lesezugriff auf Gruppen
- Lesezugriff auf Personen
- Zugriff auf Gruppenmitgliedsdaten
- Optional: Zugriff auf benutzerdefinierte Felder

## Implementierungsphasen

### Phase 1: Grundgerüst (MVP)
- [x] Projekt-Setup mit Vite und TypeScript
- [ ] PrimeVue-Integration
- [ ] ChurchTools-Authentifizierung
- [ ] Zielgruppen-Auswahl
- [ ] Erkennung des Konfigurationsfeldes
- [ ] Anleitung anzeigen, wenn Konfigurationsfeld fehlt
- [ ] Quellgruppen-Auswahl (MultiSelect)

### Phase 2: Mapping-Konfiguration
- [ ] Anzeige der Gruppenmitgliedsfelder (Ziel und Quellen)
- [ ] UI für Feldmapping (Drag & Drop oder Dropdown)
- [ ] Prioritäten festlegen
- [ ] Konfliktauflösungs-Strategie wählen
- [ ] Konfiguration im Gruppenmitgliedsfeld speichern
- [ ] Konfiguration laden und anzeigen

### Phase 3: Datenübernahme
- [ ] Mitglieder der Zielgruppe abrufen
- [ ] Mitgliedschaften in Quellgruppen prüfen
- [ ] Werte aus Quellfeldern lesen
- [ ] Konfliktauflösung anwenden
- [ ] Werte in Zielfelder schreiben
- [ ] Fortschrittsanzeige
- [ ] Protokoll mit Erfolgen/Fehlern

### Phase 4: Erweiterte Funktionen
- [ ] Vorschau vor Übernahme (Dry-Run)
- [ ] Filterung (nur bestimmte Mitglieder übernehmen)
- [ ] Automatische Übernahme (Zeitplan/Trigger)
- [ ] Historisierung (Änderungen nachvollziehen)
- [ ] Export der Konfiguration (JSON-Download)
- [ ] Import von Konfigurationen

## Offene Fragen

1. **Berechtigungsmodell**: Welche Berechtigungen sind erforderlich, um Gruppenmitgliedsfelder zu lesen/schreiben?
2. **Feldtyp-Kompatibilität**: Was passiert, wenn Quell- und Zielfeld unterschiedliche Typen haben (z.B. Text → Select)?
3. **Mehrfach-Mitgliedschaft**: Wie wird behandelt, wenn eine Person in mehreren Quellgruppen ist?
4. **Leere Werte**: Sollen leere Werte aus Quellfeldern Zielfelder überschreiben?
5. **Fehlerbehandlung**: Was passiert bei API-Fehlern während der Übernahme (Rollback oder Fortsetzung)?
6. **Konfigurationsfeld-Name**: Soll der Name des Konfigurationsfeldes fest vorgegeben oder konfigurierbar sein?
7. **Mehrsprachigkeit**: Soll die Extension mehrsprachig sein (DE/EN)?

## API-Details

### Gruppe mit Custom Fields abrufen

**Endpoint**: `GET /groups/{groupId}`

**Response**:
```typescript
{
  data: {
    id: number;
    name: string;
    information: { ... };
    settings: { ... };
    // Custom Group Fields werden auf Root-Level hinzugefügt
    field_mapping_config?: string;  // Unser Konfigurationsfeld
    // ... weitere Custom Fields
  }
}
```

### Gruppe mit Custom Fields aktualisieren

**Endpoint**: `PATCH /groups/{groupId}`

**Request Body**:
```typescript
{
  field_mapping_config: string;  // JSON-String der Konfiguration
  // ... weitere Felder
}
```

**Beispiel**:
```typescript
const config: FieldMappingConfiguration = { ... };

await churchtoolsClient.patch(`/groups/${groupId}`, {
  field_mapping_config: JSON.stringify(config)
});
```

### Gruppenmitgliedsfelder abrufen

**Endpoint**: `GET /groups/{groupId}/memberfields`

**Response**:
```typescript
{
  data: Array<GroupMemberField>
}

// GroupMemberField kann sein:
type GroupMemberField = 
  | { type: 'person', field: GroupMemberFieldPerson }
  | { type: 'group', field: GroupMemberFieldGroup }

// GroupMemberFieldGroup enthält:
interface GroupMemberFieldGroup {
  id: number;
  groupId: number;
  name: string;
  note: string | null;
  fieldTypeCode: FieldTypeCode;
  fieldTypeId: number;
  defaultValue: string;
  referenceName: string;
  options: Array<{ id: string; name: string }>;
  // ... weitere Felder
}
```

### Gruppenmitglieder mit Feldwerten abrufen

**Endpoint**: `GET /groups/{groupId}/members`

**Response**:
```typescript
{
  data: Array<{
    personId: number;
    groupId: number;
    groupMemberStatus: string;
    fields: {
      [fieldId: string]: string | null;  // Feldwerte
    };
    // ... weitere Felder
  }>
}
```

### Gruppenmitgliedsfeld-Wert aktualisieren

**Endpoint**: `PATCH /groups/{groupId}/members/{personId}`

**Request Body**:
```typescript
{
  fields: {
    [fieldId: string]: string;  // Neue Feldwerte
  }
}
```

**Beispiel**:
```typescript
// Wert im Feld 501 für Person 123 in Gruppe 100 setzen
await churchtoolsClient.patch(
  `/groups/100/members/123`,
  {
    fields: {
      "501": "Anwesend"
    }
  }
);
```

### Feldtypen (FieldTypeCode)

Verfügbare Feldtypen:
- `text` - Textfeld
- `textarea` - Mehrzeiliges Textfeld
- `select` - Auswahlfeld (Dropdown)
- `multiselect` - Mehrfachauswahl
- `checkbox` - Checkbox
- `date` - Datumsfeld
- `number` - Zahlenfeld

## Nächste Schritte

1. PrimeVue-Abhängigkeit hinzufügen
2. Basis-UI-Struktur mit PrimeVue-Komponenten erstellen
3. ChurchTools-API-Integration für Gruppen und Personen
4. Erste funktionale Version mit Gruppenauswahl und Tabellenansicht
5. Iterative Erweiterung gemäß Implementierungsphasen