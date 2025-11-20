# Fix: "Database error saving new user"

## Problema Identificato

Quando un nuovo utente prova a registrarsi, riceve l'errore **"Database error saving new user"**.

### Causa Principale

Il trigger `on_auth_user_created` è stato modificato nella migrazione `20251113_create_default_project_trigger.sql` per creare automaticamente un progetto predefinito per ogni nuovo utente. Tuttavia, questa modifica ha **sovrascritto** la funzione originale `handle_new_user()` che creava il profilo utente nella tabella `profiles`.

**Risultato**: Quando un utente si registra:
- ✅ L'utente viene creato in `auth.users`
- ✅ Viene creato un progetto predefinito in `public.projects`
- ❌ **NON** viene creato il profilo in `public.profiles`

Questo causa un errore perché altre parti del sistema si aspettano che esista un record in `profiles` per ogni utente.

## Soluzione

Ho creato una nuova migrazione che combina entrambe le operazioni in un'unica funzione:

**File**: `supabase/migrations/20251119_fix_user_registration_trigger.sql`

La nuova funzione `handle_new_user_registration()` esegue:
1. Crea il profilo utente in `public.profiles`
2. Genera un ID progetto univoco
3. Crea il progetto predefinito "My Greenhouse"

### Gestione Errori

La funzione include un blocco `EXCEPTION` che:
- Registra eventuali errori come warning
- Non blocca la creazione dell'utente
- Permette di diagnosticare problemi senza impedire la registrazione

## Come Applicare la Fix

### Opzione 1: Via Supabase Dashboard (Consigliata)

1. Vai su https://supabase.com/dashboard/project/fmyomzywzjtxmabvvjcd/sql/new
2. Apri il file `supabase/migrations/20251119_fix_user_registration_trigger.sql`
3. Copia tutto il contenuto
4. Incollalo nell'editor SQL di Supabase
5. Clicca su "Run"
6. Verifica il messaggio di successo

### Opzione 2: Via Supabase CLI

```bash
# Dalla directory del progetto Serra
cd /Users/davidecrescentini/00-Progetti/Serra

# Assicurati di essere collegato al progetto
supabase link --project-ref fmyomzywzjtxmabvvjcd

# Applica la migrazione
supabase db push
```

## Verifica

Dopo aver applicato la migrazione, verifica che funzioni:

### 1. Controlla che la funzione sia stata creata

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user_registration';
```

Dovrebbe restituire 1 riga.

### 2. Controlla che il trigger sia attivo

```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

Dovrebbe mostrare il trigger su `auth.users`.

### 3. Testa la registrazione

1. Prova a registrare un nuovo utente dall'interfaccia
2. Verifica che venga creato senza errori
3. Controlla che siano stati creati sia il profilo che il progetto:

```sql
-- Sostituisci con l'email del nuovo utente di test
SELECT 
  u.email,
  p.full_name,
  pr.name as project_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.projects pr ON pr.user_id = u.id
WHERE u.email = 'test@example.com';
```

Dovrebbe mostrare:
- Email dell'utente
- Nome completo (se fornito)
- Nome del progetto ("My Greenhouse")

## Utenti Esistenti

Se ci sono utenti che si sono registrati dopo la migrazione `20251113_create_default_project_trigger.sql` ma prima di questa fix, potrebbero non avere un profilo. Per correggerli:

```sql
-- Trova utenti senza profilo
SELECT u.id, u.email 
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Crea profili mancanti
INSERT INTO public.profiles (id, full_name)
SELECT u.id, u.raw_user_meta_data->>'full_name'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

## File Modificati

- ✅ Creato: `supabase/migrations/20251119_fix_user_registration_trigger.sql`
- 📝 Questo documento: `FIX_USER_REGISTRATION.md`

## Prossimi Passi

1. Applica la migrazione su Supabase
2. Testa la registrazione di un nuovo utente
3. Se ci sono utenti esistenti senza profilo, esegui la query di correzione
4. Monitora i log per eventuali warning

## Note Tecniche

### Perché è successo?

La migrazione `20251113_create_default_project_trigger.sql` conteneva:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_for_user();
```

Questo ha **rimosso** il trigger originale che chiamava `handle_new_user()`, sostituendolo con uno che chiama solo `create_default_project_for_user()`.

### La soluzione

Invece di avere due trigger separati (non supportato da PostgreSQL per lo stesso evento), abbiamo creato una singola funzione che esegue entrambe le operazioni in sequenza.
