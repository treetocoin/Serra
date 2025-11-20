# Feature Specification: Rinominare Progetto in Ciclo e Gestione Durata Ciclo

**Feature Branch**: `007-fai-che-d`
**Created**: 2025-11-20
**Status**: Draft
**Input**: User description: "fai che d'ora in poi quello che chiamavamo 'progetto' si chiama 'Ciclo'. quando crei un utente si crea anche un ciclo. da impostazioni voglio poter aggiungere la durata del ciclo (in settimane) e a quale settimana siamo. nella dashboard aggiungi un indicatore di che punto è il ciclo"

## Clarifications

### Session 2025-11-20

- Q: Come devono comportarsi i dati storici dei sensori quando si introduce il concetto di Ciclo? → A: Tutti i dati storici vengono retroattivamente associati al primo ciclo dell'utente durante la migrazione
- Q: Cosa succede quando un ciclo raggiunge il 100% di completamento? → A: Il sistema avvisa l'utente che il ciclo è completo e offre un pulsante per iniziare un nuovo ciclo
- Q: Quale livello di dettaglio devono avere i messaggi di errore di validazione? → A: Messaggi con suggerimento che guidano l'utente su come risolvere l'errore
- Q: Quali eventi relativi ai cicli devono essere tracciati/loggati? → A: L'obiettivo è ricavare più dati possibile relativi allo stato fase/ciclo per addestrare una IA in futuro
- Q: Dove dovrebbe essere posizionato l'indicatore di progresso per massimizzare visibilità? → A: Sezione dedicata in alto nella dashboard, larga tutta la pagina (full-width banner)

## User Scenarios & Testing

### User Story 1 - Creazione Automatica Ciclo (Priority: P1)

Un nuovo utente si registra al sistema e il sistema crea automaticamente il suo primo ciclo di coltivazione. L'utente può iniziare immediatamente a tracciare la sua coltivazione senza dover configurare manualmente il concetto di "ciclo".

**Why this priority**: Questo è il fondamento dell'intera feature - senza cicli automaticamente creati, nessuna altra funzionalità di gestione ciclo può funzionare. È la base MVP.

**Independent Test**: Può essere testato registrando un nuovo utente e verificando che esista un ciclo associato nel database. Fornisce valore immediato permettendo al sistema di tracciare le coltivazioni per ciclo fin dal primo giorno.

**Acceptance Scenarios**:

1. **Given** nessun utente esiste nel sistema, **When** un nuovo utente completa la registrazione, **Then** il sistema crea automaticamente un ciclo attivo associato a quell'utente
2. **Given** un nuovo ciclo è stato creato per l'utente, **When** l'utente accede alla dashboard, **Then** l'utente vede i propri dati organizzati per il ciclo corrente
3. **Given** un utente appena registrato, **When** l'utente naviga nelle impostazioni, **Then** l'utente può vedere il ciclo creato automaticamente con valori predefiniti

---

### User Story 2 - Configurazione Durata Ciclo (Priority: P2)

Un utente accede alle impostazioni e configura la durata totale del suo ciclo di coltivazione (es. 12 settimane per una coltivazione completa) e imposta a quale settimana del ciclo si trova attualmente (es. settimana 4).

**Why this priority**: Fornisce controllo all'utente sulla pianificazione del ciclo, ma il ciclo può esistere anche senza questa configurazione (con valori predefiniti). Diventa utile quando l'utente vuole personalizzare la propria pianificazione.

**Independent Test**: Può essere testato aprendo le impostazioni, modificando durata e settimana corrente, salvando, e verificando che i valori siano persistiti. Fornisce valore permettendo pianificazione personalizzata.

**Acceptance Scenarios**:

1. **Given** un utente con un ciclo attivo, **When** l'utente accede alla sezione impostazioni, **Then** l'utente vede campi per impostare "durata ciclo (settimane)" e "settimana corrente"
2. **Given** l'utente è nella sezione impostazioni, **When** l'utente inserisce una durata di 12 settimane e settimana corrente 4, e salva, **Then** il sistema memorizza questi valori per il ciclo corrente
3. **Given** l'utente ha configurato durata e settimana corrente, **When** l'utente riapre le impostazioni, **Then** i valori precedentemente salvati sono visualizzati correttamente
4. **Given** l'utente tenta di impostare settimana corrente, **When** inserisce un numero maggiore della durata totale, **Then** il sistema mostra un messaggio di errore e non salva

---

### User Story 3 - Visualizzazione Progress Ciclo in Dashboard (Priority: P3)

Un utente apre la dashboard e vede immediatamente un indicatore visuale che mostra a che punto del ciclo di coltivazione si trova (es. "Settimana 4 di 12 - 33% completato").

**Why this priority**: Migliora l'esperienza utente con feedback visuale, ma dipende dalle altre funzionalità per avere dati da visualizzare. È un enhancement dell'interfaccia.

**Independent Test**: Può essere testato configurando un ciclo con durata e settimana corrente, poi aprendo la dashboard e verificando che l'indicatore mostri i dati corretti. Fornisce valore tramite migliore consapevolezza dello stato della coltivazione.

**Acceptance Scenarios**:

1. **Given** un utente con ciclo configurato (durata: 12, settimana: 4), **When** l'utente apre la dashboard, **Then** l'utente vede un indicatore che mostra "Settimana 4 di 12"
2. **Given** l'utente visualizza l'indicatore, **When** il ciclo ha valori configurati, **Then** l'indicatore mostra anche una percentuale di completamento (33%)
3. **Given** un utente con ciclo non ancora configurato, **When** l'utente apre la dashboard, **Then** l'indicatore mostra valori predefiniti o un messaggio per invitare a configurare il ciclo
4. **Given** l'utente ha un ciclo alla settimana 12 di 12, **When** l'utente visualizza l'indicatore, **Then** l'indicatore mostra "100% completato" o stato equivalente

---

### Edge Cases

- Cosa succede quando un utente cerca di impostare la settimana corrente a un valore maggiore della durata totale del ciclo? → Il sistema mostra un messaggio di errore e non salva (FR-005)
- Come gestisce il sistema la visualizzazione quando un ciclo non ha ancora durata configurata? → L'indicatore mostra valori predefiniti (12 settimane, settimana 1)
- Cosa succede se un utente imposta durata 0 o numeri negativi? → Il sistema valida e rifiuta (FR-011)
- Come gestisce il sistema utenti legacy che erano stati creati prima dell'implementazione di questa feature? → Script batch crea ciclo e associa dati storici (FR-009, FR-010)
- Cosa succede quando un ciclo raggiunge il 100% di completamento? → Il sistema mostra avviso e offre pulsante per nuovo ciclo (FR-012, FR-013)

## Requirements

### Functional Requirements

- **FR-001**: Il sistema DEVE rinominare tutti i riferimenti al concetto "progetto" in "Ciclo" nell'interfaccia utente
- **FR-002**: Il sistema DEVE creare automaticamente un ciclo quando viene creato un nuovo utente
- **FR-003**: Gli utenti DEVONO poter visualizzare e modificare la durata del ciclo (in settimane) dalla sezione impostazioni
- **FR-004**: Gli utenti DEVONO poter visualizzare e modificare la settimana corrente del ciclo dalla sezione impostazioni
- **FR-005**: Il sistema DEVE validare che la settimana corrente non superi la durata totale del ciclo e mostrare un messaggio di errore con suggerimento per la risoluzione (es. "La settimana corrente non può superare la durata. Imposta prima una durata maggiore.")
- **FR-006**: Il sistema DEVE visualizzare un indicatore di progresso del ciclo come sezione dedicata in alto nella dashboard, con larghezza pari al 100% della pagina (full-width banner)
- **FR-007**: L'indicatore DEVE mostrare in modo chiaro settimana corrente, durata totale, e percentuale di completamento con elementi visivi appropriati
- **FR-008**: Il sistema DEVE persistere le modifiche alla durata e settimana corrente del ciclo
- **FR-009**: Il sistema DEVE gestire utenti legacy (creati prima di questa feature) eseguendo uno script batch una tantum al momento del deployment che crea un ciclo predefinito per tutti gli utenti esistenti
- **FR-010**: Il sistema DEVE associare retroattivamente tutti i dati storici di sensori, attuatori e letture al primo ciclo dell'utente durante la migrazione batch
- **FR-011**: Il sistema DEVE validare che durata e settimana corrente siano numeri positivi maggiori di zero e mostrare messaggi di errore con suggerimenti (es. "La durata deve essere almeno 1 settimana. Inserisci un numero positivo.")
- **FR-012**: Il sistema DEVE mostrare un avviso all'utente quando il ciclo raggiunge il 100% di completamento (settimana corrente = durata totale)
- **FR-013**: Il sistema DEVE offrire un pulsante o controllo per iniziare un nuovo ciclo quando il ciclo corrente è al 100%
- **FR-014**: Il sistema DEVE tracciare tutti gli eventi significativi del ciclo per raccolta dati finalizzata all'addestramento di IA, includendo: creazione ciclo, modifica durata, modifica settimana corrente, completamento ciclo, associazione nuove letture sensori al ciclo
- **FR-015**: Il sistema DEVE persistere i metadati temporali di ogni evento del ciclo (timestamp, stato precedente, stato successivo) per analisi successive

### Key Entities

- **Ciclo**: Rappresenta un periodo di coltivazione con durata definita in settimane. Attributi chiave: durata totale (settimane), settimana corrente, data inizio, data fine calcolata, stato (attivo/completato). Ogni ciclo è associato a un utente.
- **Utente**: Include riferimento al ciclo corrente attivo. Relazione: un utente ha uno o più cicli nel tempo, ma solo un ciclo può essere attivo.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Nuovi utenti hanno un ciclo creato automaticamente entro 1 secondo dalla registrazione
- **SC-002**: Utenti possono configurare durata e settimana del ciclo in meno di 30 secondi dalla sezione impostazioni
- **SC-003**: L'indicatore di progresso nella dashboard mostra dati accurati entro 100ms dall'apertura della pagina
- **SC-004**: 100% delle istanze della parola "progetto" nell'UI sono sostituite con "Ciclo"
- **SC-005**: Sistema previene il 100% dei tentativi di salvare settimana corrente maggiore della durata totale
- **SC-006**: Utenti possono comprendere immediatamente a che punto del ciclo si trovano guardando la dashboard (misurato tramite test di usabilità con tempo medio di comprensione < 3 secondi)
- **SC-007**: Il sistema traccia e persiste il 100% degli eventi significativi del ciclo con metadati temporali completi per analisi futura

## Assumptions

- Si assume che ogni utente abbia solo un ciclo attivo alla volta
- Si assume durata ciclo predefinita di 12 settimane e settimana corrente 1 per cicli creati automaticamente
- Si assume che il tracking del progresso sia manuale (l'utente aggiorna la settimana corrente) e non automatico basato su date
- Si assume che il termine "Ciclo" sia comprensibile nel dominio della coltivazione senza necessità di glossario
- Si assume che dispositivi, sensori, attuatori e tutte le loro letture storiche vengano associati al primo ciclo creato per ogni utente legacy durante la migrazione batch
- Si assume che i dati raccolti sugli eventi del ciclo saranno utilizzati in futuro per addestrare modelli di intelligenza artificiale per ottimizzazione delle coltivazioni

## Scope & Boundaries

### In Scope
- Rinomina terminologia da "progetto" a "Ciclo" in tutta l'interfaccia
- Creazione automatica ciclo alla registrazione utente
- Configurazione durata e settimana corrente da impostazioni
- Visualizzazione indicatore progresso in dashboard
- Validazione input per durata e settimana

### Out of Scope
- Gestione di cicli multipli simultanei per utente
- Avanzamento automatico della settimana basato su calendario
- Archivio storico di cicli completati (può essere aggiunto in futuro)
- Notifiche o alert basati su milestone del ciclo
- Comparazione tra cicli diversi
- Template di cicli predefiniti per tipi di coltivazione diversi
