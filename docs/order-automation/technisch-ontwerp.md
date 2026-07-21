# Technisch ontwerp — Orderflow & capaciteitsplanning

**Project:** Automatisering installatie-orderflow (WooCommerce/FunnelKit → Maatwerkportaal)
**Opdrachtgever:** Thuisbatterij.nl
**Status:** Voorstel / kickoff — reactie op de briefing

Dit document beantwoordt de drie gestelde vragen, beschrijft de aanbevolen
architectuur en geeft een urenraming. De referentie-code in dit document is
bedoeld als vertrekpunt en is bewust **niet** in de live plugin verwerkt.

---

## 0. Samenvatting van het advies

| Onderwerp | Advies (kort) |
|-----------|---------------|
| Data van WP naar portaal | **Server-to-server webhook** (WP → REST-endpoint van het portaal), HMAC-ondertekend, met **retry via Action Scheduler**. Foto's als **URL's**, niet als binaire data. |
| PDF genereren | **In het portaal**, op basis van de ontvangen data. WordPress blijft een dunne intake-laag. |
| Raming portaal-logica | **MVP ± 60 uur (~2 weken)**, robuuste v1 **90–140 uur (~3–4 weken)** voor één developer. WordPress-koppeling apart **16–24 uur**. |
| Installatiedatum in formulier | **Ja, aanbevolen** — anders kan het portaal geen dagsaldo per datum bepalen. |

---

## 1. Vraag 1 — Hoe pushen we formulierdata + foto's van WordPress naar het portaal?

**Aanbeveling: één server-to-server webhook vanuit WordPress naar een REST-endpoint
van het portaal.** "REST API" en "webhook" zijn hier hetzelfde mechanisme: het portaal
publiceert een endpoint (bijv. `POST /api/v1/intake`), WordPress roept dat aan zodra het
Gravity Forms-formulier is verzonden.

### Waarom niet de standaard WooCommerce-webhook?
De standaard WooCommerce-webhook stuurt alleen order-data. Wij hebben de **order én de
Gravity Forms-antwoorden én de foto-URL's samengevoegd** nodig in één payload. Daarom een
eigen sender die op `gform_after_submission` de order-context erbij zoekt en één complete
payload verstuurt.

### Foto's: stuur URL's, geen binaire data
De briefing noemt al "afbeeldings-URL's" — dat is de juiste keuze. Aandachtspunt: de
standaard WordPress media-URL's zijn publiek raadbaar. Twee veilige opties:

1. **Beschermde uploads + ondertekende (verlopende) URL's** — het portaal haalt de foto
   binnen een kort tijdvenster op.
2. **Portaal trekt de foto's direct binnen** bij ontvangst en slaat een eigen kopie op;
   daarna mag WordPress ze desnoods opruimen. **Dit heeft mijn voorkeur** — het portaal is
   dan niet afhankelijk van de beschikbaarheid van de WP-site.

### Beveiliging (essentieel)
- **HTTPS** verplicht.
- **HMAC-SHA256-handtekening** over de payload met een gedeeld secret, in een header
  (bijv. `X-TB-Signature`). Het portaal verifieert deze.
- **Timestamp + nonce** tegen replay-aanvallen (payload ouder dan bijv. 5 min → weigeren).
- Alternatief: OAuth2 client-credentials met bearer-token. HMAC is voor server-to-server
  eenvoudiger en even robuust.

### Betrouwbaarheid (essentieel)
- **Idempotency-key** = WooCommerce Order ID + Gravity Forms entry ID. Zo leidt een
  dubbele verzending nooit tot een dubbele klus.
- **Retry met backoff via Action Scheduler** (zit al in WooCommerce). Portaal down? Dan
  gaat de inzending niet verloren maar wordt opnieuw aangeboden.
- Portaal antwoordt `2xx` bij succes; bij `4xx/5xx` → opnieuw in de wachtrij.

### Referentie: WordPress-sender (vertrekpunt)

```php
<?php
// Draait op inzending van het intake-formulier (vervang 7 door het Gravity Forms-ID).
add_action( 'gform_after_submission_7', 'tb_intake_push', 10, 2 );

function tb_intake_push( $entry, $form ) {
    // Order-ID koppelen (bijv. via een verborgen veld gevuld vanuit de FunnelKit-mail).
    $order_id = absint( rgar( $entry, '10' ) );

    $payload = array(
        'idempotency_key' => $order_id . '-' . $entry['id'],
        'order_id'        => $order_id,
        'submitted_at'    => gmdate( 'c' ),
        'customer'        => array(
            'name'     => rgar( $entry, '1' ),
            'email'    => rgar( $entry, '2' ),
            'postcode' => strtoupper( preg_replace( '/\s+/', '', rgar( $entry, '3' ) ) ),
        ),
        'preferred_date'  => rgar( $entry, '4' ), // zie §4: datum in formulier
        'answers'         => tb_collect_answers( $entry, $form ),
        'photo_urls'      => tb_collect_uploads( $entry, $form ),
    );

    // Async wegschrijven met retry; werkelijke verzending in tb_intake_send().
    as_enqueue_async_action( 'tb_intake_send', array( $payload ), 'tb-intake' );
}

add_action( 'tb_intake_send', 'tb_intake_send' );
function tb_intake_send( $payload ) {
    $secret = defined( 'TB_PORTAL_SECRET' ) ? TB_PORTAL_SECRET : '';
    $body   = wp_json_encode( $payload );
    $sig    = hash_hmac( 'sha256', $body, $secret );

    $res = wp_remote_post( 'https://portaal.thuisbatterij.nl/api/v1/intake', array(
        'timeout' => 20,
        'headers' => array(
            'Content-Type'  => 'application/json',
            'X-TB-Signature'=> $sig,
            'X-TB-Timestamp'=> (string) time(),
        ),
        'body'    => $body,
    ) );

    $code = is_wp_error( $res ) ? 0 : wp_remote_retrieve_response_code( $res );
    if ( $code < 200 || $code >= 300 ) {
        // Gooi een exception → Action Scheduler plant automatisch een retry.
        throw new Exception( 'Intake push mislukt, HTTP ' . $code );
    }
}
```

---

## 2. Vraag 2 — PDF genereren op WordPress of in het portaal?

**Aanbeveling: genereer de PDF in het portaal**, op basis van de binnengekomen,
gestructureerde data.

**Waarom in het portaal:**
- **Eén bron van waarheid.** Het portaal heeft alle antwoorden + foto-URL's al binnen.
  Op WP genereren betekent een tweede datapad dat gesynchroniseerd moet blijven.
- **De PDF heeft portaal-context nodig** die WordPress niet heeft: toegewezen
  installatiepartner, klusreferentie, geplande datum, dagvolgnummer.
- **Hergenereren zonder round-trip.** Wijzigt het sjabloon of corrigeer je een antwoord,
  dan maakt het portaal de PDF opnieuw — zonder WordPress erbij te betrekken.
- **Ontkoppeling en kosten.** WordPress blijft puur intake/checkout; minder plugin-oppervlak,
  geen Gravity PDF-licentie nodig, minder onderhoud.

**Uitzondering:** wil je de klant direct op de site een bevestigings-PDF tonen, dan is
Gravity PDF daarvoor prima. Maar de **gezaghebbende partner-PDF** hoort in het portaal.

Technisch in het portaal: HTML-sjabloon → PDF via bijv. wkhtmltopdf, Puppeteer/headless
Chromium (beste weergave) of DomPDF (lichtgewicht). De partner ontvangt de PDF als bijlage
in de notificatiemail.

---

## 3. Vraag 3 — Urenraming database- & toewijzingslogica in het portaal

Aannames: één developer, een bestaand portaal-framework met database en auth. Zie de open
punten in §4 — die kunnen de raming verschuiven.

### Portaal

| Component | MVP | Robuuste v1 |
|-----------|-----|-------------|
| Datamodel + migraties (partners, postcodedekking, klussen, dagcapaciteit) | 6 u | 8 u |
| A. Beheer partners + postcodegebieden + max. dagcapaciteit (CRUD) | 12 u | 20 u |
| B. Toewijzingslogica: regiofilter → capaciteitsfilter → round-robin → fallback | 12 u | 24 u |
| C. Intake-endpoint (HMAC-verificatie, idempotentie, validatie, media ophalen) | 10 u | 18 u |
| PDF-generatie + partner-notificatiemail | 8 u | 16 u |
| Fallback: wachtrij 'Handmatige controle' + melding klantenservice | 6 u | 12 u |
| Testen (unit voor capaciteits-edge-cases, race conditions, integratie) | 6 u | 16 u |
| Logging/observability, admin-afwerking, documentatie | 4 u | 12 u |
| **Totaal portaal** | **± 64 u (~2 wk)** | **± 126 u (~3–4 wk)** |

### WordPress-koppeling (los)

| Component | Uren |
|-----------|------|
| Webhook-sender + Gravity Forms-integratie + Order-ID-koppeling | 8–12 u |
| HMAC-ondertekening, Action Scheduler-retry, idempotentie | 6–8 u |
| Testen + uitrol | 2–4 u |
| **Totaal WordPress** | **16–24 u (~3–4 dagen)** |

### Risico's die de raming beïnvloeden
- **Concurrency op de laatste slot.** Twee inzendingen die tegelijk de 10e plek pakken →
  je overschrijdt de limiet zonder database-locking. Los op met een transactie
  (`SELECT … FOR UPDATE` of een atomische teller per partner+datum). Dit is de belangrijkste
  reden dat de "robuuste v1" meer test-uren heeft dan de MVP.
- **Postcode-granulariteit.** 2 vs. 4 cijfers, en overlappende dekking tussen partners.
  NL-postcodes zijn 4 cijfers + 2 letters.
- **Installatiedatum** (zie §4) — bepaalt of capaciteit per dag überhaupt te toetsen is.

---

## 4. Open punten (de twee vragen uit de briefing, met mijn advies)

1. **Kiest de klant zelf een installatiedatum in het formulier?**
   **Advies: ja.** Capaciteit is gedefinieerd als "max. 10 klussen per dag per partner".
   Zonder gekozen datum kan het portaal op inzendingsmoment geen dagsaldo toetsen. Praktisch
   alternatief: de klant kiest een **voorkeursweek** en de partner bevestigt de exacte dag —
   maar dan verschuift de capaciteitscheck naar een later moment en wordt de logica complexer.
   Mijn voorkeur: een concrete voorkeursdatum (of enkele opties) in het formulier.

2. **Bestaat er al API-documentatie / een vaste stack voor het portaal?**
   Dit bepaalt het ontwerp van het intake-endpoint (auth-schema, veldnamen, framework). Graag
   ontvang ik de bestaande docs of een korte omschrijving van de portaal-stack, zodat ik het
   endpoint daarop aansluit in plaats van een nieuw contract te introduceren.

---

## 5. Referentie: toewijzingslogica ("het brein")

Framework-agnostisch (PHP-stijl pseudocode). Kernpunt: de toewijzing draait binnen **één
databasetransactie met een lock**, zodat de capaciteitslimiet niet door race conditions wordt
overschreden.

### Datamodel (schets)

```sql
-- Partners
partners(id, naam, email, max_per_dag DEFAULT 10, actief BOOL)

-- Postcodedekking: partner actief in postcodeprefix (2 of 4 cijfers)
partner_postcodes(id, partner_id, prefix)          -- bijv. prefix = '10' of '1012'

-- Klussen / toewijzingen
klussen(id, order_id, entry_key UNIQUE, postcode, datum,
        partner_id NULL, status)                    -- status: toegewezen | handmatige_controle
```

### Algoritme

```php
function wijs_klus_toe( PDO $db, array $klus ): array {
    $db->beginTransaction();

    // 1. Regiofilter — partners actief in het postcodegebied van de klant.
    //    Match op langst mogelijke prefix eerst (4 cijfers vóór 2 cijfers).
    $prefix4 = substr( $klus['postcode'], 0, 4 );
    $prefix2 = substr( $klus['postcode'], 0, 2 );

    // 2. Capaciteitsfilter + 3. round-robin in één query:
    //    partners in de regio, nog niet vol op die datum, oplopend op huidige belasting.
    //    FOR UPDATE vergrendelt de rijen tot commit → geen dubbele laatste slot.
    $stmt = $db->prepare("
        SELECT p.id,
               COALESCE(COUNT(k.id), 0) AS klussen_vandaag,
               p.max_per_dag
        FROM partners p
        JOIN partner_postcodes pp ON pp.partner_id = p.id
        LEFT JOIN klussen k
               ON k.partner_id = p.id AND k.datum = :datum
        WHERE p.actief = 1
          AND pp.prefix IN (:prefix4, :prefix2)
        GROUP BY p.id, p.max_per_dag
        HAVING klussen_vandaag < p.max_per_dag
        ORDER BY klussen_vandaag ASC, p.id ASC
        LIMIT 1
        FOR UPDATE
    ");
    $stmt->execute( compact( 'prefix4', 'prefix2' ) + array( 'datum' => $klus['datum'] ) );
    $partner = $stmt->fetch();

    // 4. Fallback — niemand beschikbaar → handmatige controle + melding klantenservice.
    if ( ! $partner ) {
        $status = 'handmatige_controle';
        $partner_id = null;
        meld_klantenservice( $klus );
    } else {
        $status = 'toegewezen';
        $partner_id = $partner['id'];
    }

    // Idempotent wegschrijven (entry_key is UNIQUE).
    schrijf_klus_weg( $db, $klus, $partner_id, $status );
    $db->commit();

    if ( $partner_id ) {
        genereer_pdf_en_notificeer_partner( $klus, $partner_id );
    }
    return array( 'partner_id' => $partner_id, 'status' => $status );
}
```

Deze query dekt in één keer stap 1 (regio), 2 (capaciteit, via `HAVING`), 3 (eerlijke
verdeling, via `ORDER BY klussen_vandaag ASC`) en de basis voor 4 (leeg resultaat → fallback).

---

## 6. Volledige flow (overzicht)

1. Klant plaatst order via FunnelKit-checkout → WooCommerce legt order + postcode vast.
2. FunnelKit Automations mailt de klant een link naar het Gravity Forms-formulier
   (met verborgen Order-ID-veld).
3. Klant beantwoordt vragen + uploadt foto's → `gform_after_submission` → **webhook** naar
   `POST /api/v1/intake` (HMAC-ondertekend, foto's als URL's).
4. Portaal verifieert handtekening, haalt foto's binnen, draait de **toewijzingslogica**
   (§5) binnen een transactie.
5. Portaal genereert de **PDF** (§2) en mailt de toegewezen partner de notificatie + bijlage.
   Bij volle regio → status *Handmatige controle* + melding klantenservice.
