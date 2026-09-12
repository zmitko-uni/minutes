# Minutes — příručka pro uživatele

Minutes rozšiřuje Signal Desktop o **nahrávání hovorů**, **přepisy**, **AI shrnutí chatů** a **záložky** na důležité zprávy.

Vaše data (nahrávky, exporty, modely) zůstávají **primárně u vás na disku**. Cloud AI je volitelné — používáte vlastní API klíč, nebo můžete shrnovat **lokálně** bez internetu.

V levé liště s ikonami jsou hned za Chaty a Hovory dva taby Minutes: **M** = **Přepisy** a ikona **záložky** = **Záložky**. Oba se otevřou na celé obrazovce.

---

## Za 5 minut — rychlý start

### 1. Zapněte AI shrnutí (volitelné, ale doporučené)

1. Otevřete **Menu → Minutes → Nastavení AI**
2. Zapněte **Povolit AI shrnutí**
3. Nastavte v tomto pořadí:
   - **Jazyk shrnutí** — nechte `cs` pro češtinu
   - **Styl shrnutí** — nechte **Stručný**, nebo zvolte Detailní / Smart / Vlastní
   - **Poskytovatel** — vyberte, kdo bude tvořit shrnutí
   - Podle poskytovatele doplňte **model** a **API klíč**, nebo u lokálního Gemma **stáhněte model**
4. Klikněte **Otestovat summarizaci**, pak **Uložit**

### 2. Sumarizujte chat

- **Ctrl+Shift+U** — shrnutí otevřeného chatu
- Nebo pravý klik na zprávu → **Minutes: Sumarizovat odtud**
- Nebo menu chatu → **Sumarizovat poslední 1 / 8 / 24 hodin**

Výsledek najdete ve složce sumarizací (menu **Otevřít sumarizace chatů**). Zelená lišta nabídne odeslání do chatu nebo sobě.

### 3. Nahrajte a přepište hovor

1. Během hovoru zvolte **nahrávání zvuku** nebo **nahrávání sdíleného videa** (vedle mute)
2. V potvrzení **Nahrávání se chystá spustit** klikněte **Spustit nahrávání** (nebo **Zrušit**, pokud nahrávat nechcete)
3. Po skončení se nahrávka uloží automaticky
4. Pro přepis audio i video nahrávky v **Nastavení Přepisů (Minutes)** jednorázově stáhněte Whisper model **Large v3 Turbo** (doporučeno)
5. Přepis a shrnutí najdete v **Přepisy (Minutes)**

### Zvonění ve velké skupině

V běžném Signálu se u skupin **od 16 členů** zvonění vypíná (hovor jde spustit, ale ostatní nezvoní). **Minutes zvonění ve velkých skupinách ponechává** — v lobby zůstane tlačítko zvonění aktivní.

Aby ostatní opravdu slyšeli vyzvánění, musí mít také **Minutes** (stock Signal zvonění u velké skupiny potlačí).

---

## Nastavení AI — podrobný návod

Dialog **Minutes → Nastavení AI** je uspořádaný shora dolů:

| Pořadí | Co nastavíte | Popis |
|--------|--------------|-------|
| 1 | Povolit AI shrnutí | Zapne/vypne AI u chatů a hovorů |
| 2 | Opravit přepis hovoru | Po Whisperu opraví zjevné chyby v textu |
| 3 | **Jazyk shrnutí** | `cs` = čeština, `en` = angličtina |
| 4 | **Styl shrnutí** | Stručný / Detailní / Smart / Vlastní |
| 5 | **Poskytovatel** | Kdo shrnutí vytvoří |
| 6 | Model + klíč / stažení | Zobrazí se podle zvoleného poskytovatele |

### Styl shrnutí

Platí pro **sumarizaci chatů** i **AI shrnutí hovorů**. Nepřečtené zprávy mají vlastní krátký formát (TÉMA / TYP) a tento výběr je neovlivní.

| Styl | Co dostanete |
|------|----------------|
| **Stručný** *(výchozí)* | Pár vět, jen úkoly, které někdo opravdu převzal |
| **Detailní** | Delší průběh, u úkolů kdo / co / termín pokud zazněl |
| **Smart** | Délku zvolí model podle rozsahu přepisu |
| **Vlastní** | Doplníte vlastní instrukce (tón, důraz). Formát zprávy v Signalu zůstane stejný |

U každého stylu lze **zobrazit prompt** — co model vždy dostane. Tuto část nelze přepsat (drží prostý text pro Signal). U **Vlastní** se vaše instrukce přidají na konec.

Po přepisu hovoru se použije aktuálně uložený styl. V **Přepisy (Minutes)** u hotového přepisu můžete **Přegenerovat shrnutí** — stačí předtím v Nastavení AI změnit styl a uložit.

### Cloud poskytovatel (OpenAI, Gemini, Claude, Perplexity)

1. Zvolte poskytovatele
2. Vyberte **model** (levnější modely jsou v seznamu první). U **Google Gemini** lze seznam obnovit z API tlačítkem **Obnovit seznam modelů** (vyžaduje vyplněný nebo již uložený API klíč) — objeví se i novější Flash modely (např. `gemini-3.6-flash`, `gemini-3.5-flash-lite`).
3. Vložte **API klíč** — odkaz „kde klíč získat“ je přímo pod polem
4. **Otestovat summarizaci** → **Uložit**

Klíče u ostatních poskytovatelů zůstávají uložené. Chcete-li později přepnout na Gemini, stačí změnit poskytovatele a doplnit jeho klíč.

| Poskytovatel | Kde získat klíč | Levný model pro start |
|--------------|-----------------|------------------------|
| OpenAI (ChatGPT) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `gpt-4o-mini` |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-3.5-flash-lite` |
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `claude-haiku-4-5` |
| Perplexity | [perplexity.ai → API](https://www.perplexity.ai/settings/api) | `sonar` |

> **Poznámka:** Předplatné ChatGPT Plus, Claude Pro nebo Cursor **není** totéž co API klíč. Minutes potřebuje pay-as-you-go API účet u poskytovatele.

### Lokální LLM (Gemma) — bez API klíče

1. Zvolte poskytovatele **Lokální LLM (Gemma)**
2. Vyberte model ke stažení:

| Model | RAM | Velikost | Kdy použít |
|-------|-----|----------|------------|
| **Gemma 3 4B** | od 8 GB | cca 2,5 GB | Slabší PC, rychlejší shrnutí |
| **Gemma 3 12B** | od 12 GB | cca 7,5 GB | Kompromis kvalita/rychlost |
| **Gemma 4 12B** *(doporučeno)* | od 16 GB | cca 7 GB | Nejlepší kvalita, včetně češtiny |

3. Klikněte **Stáhnout a aktivovat** (během stahování lze **Zrušit stahování**)
4. **Uložit** nastavení

Shrnutí proběhne **jen na vašem počítači** — nic se neposílá do cloudu. První shrnutí může trvat déle (načtení modelu do paměti).

---

## Sumarizace konverzací

### Co dostanete

- Soubor **Markdown** (`.md`) s přepisem zpráv
- Volitelně sekci **AI Summary** (pokud je AI zapnuté a nastavené) — podle **stylu shrnutí** v Nastavení AI
- Metadata v `.json` souboru

### Jak spustit

| Situace | Jak na to |
|---------|-----------|
| Celý otevřený chat | **Ctrl+Shift+U** nebo menu Minutes |
| Od konkrétní zprávy | Pravý klik → **Minutes: Sumarizovat odtud** |
| Poslední 1 / 8 / 24 h | Menu **⋯** v hlavičce chatu → Minutes |
| Chat v levém panelu | Pravý klik na konverzaci → sumarizace |

### Kam se ukládá

`%APPDATA%\Minutes\minutes\summaries\`

Po dokončení se zobrazí zelená lišta — můžete **odeslat do chatu**, **poslat sobě** nebo **otevřít soubor**.

### Bez AI klíče

Export proběhne vždy — uloží se přepis zpráv. Lišta upozorní, že AI shrnutí chybí nebo je vypnuté.

---

## Nahrávání a přepis hovorů

### Nahrávání během hovoru

V obrazovce hovoru (vedle mute) jsou dvě samostatné akce:

- **Nahrávání zvuku** — po potvrzení začne ukládat MP3 (funguje i bez Whisperu)
- **Nahrávání sdíleného videa** — WebM obsahující pouze obraz, který někdo sdílí přes Signal, a zvuk hovoru přímo z RingRTC; vaše vlastní sdílení se zapisuje z odchozího RingRTC video streamu, nikoli novým snímáním obrazovky
- **Pause / Resume** — pozastaví / obnoví aktivní nahrávku i log řečníků; při obnovení se potvrzení nezobrazuje
- **Stop** — ukončí a uloží aktivní nahrávku

Obě nahrávání jsou vzájemně výlučná. Video lze spustit i bez aktivního sdílení; do té doby obsahuje černý obraz se zvukem. Kamery účastníků ani okno Signalu se do videa nenahrávají. Audio i video nahrávky se po uložení automaticky přepíšou přes Whisper.

Po **skončení hovoru** se aktivní nahrávka uloží automaticky.

Minutes zaznamenává, **kdo mluvil** (podle aktivity mikrofonu ve skupině i u vás). To pomáhá u přepisu a shrnutí přiřadit věty správným lidem.

### Přepis (Whisper)

1. **Menu → Minutes → Nastavení Přepisů (Minutes)**
2. Stáhněte model **Large v3 Turbo** *(doporučeno)* — u češtiny nejlepší poměr přesnosti a rychlosti, zejména s GPU
3. Zkontrolujte řádek **Akcelerace přepisu** — měl by ukázat `GPU — …` (ne CPU), pokud máte zapnuté GPU v nastavení
4. Máte-li **více grafických karet**, v sekci **Výkon přepisu** zvolte **Grafická karta pro akceleraci** (typicky diskrétní NVIDIA/AMD místo integrované)
5. Po nahrání hovoru se přepis spustí sám (fronta v **Přepisy (Minutes)**)

**Tip:** Model **Medium** je menší alternativa pro slabší PC bez grafiky. **Small** je rychlejší, ale u češtiny často dělá chyby. **Large v3** je nejpřesnější, ale nejpomalejší.

Přepis probíhá **lokálně** — audio se do cloudu neposílá. Do cloudu jde až text, pokud zapnete **AI shrnutí** nebo **AI korekci přepisu**.

### Tab Přepisy — práce s nahrávkami

Tab **Přepisy** (ikona **M** v levé liště nebo **Ctrl+Shift+M**) vypadá podobně jako Chaty a Hovory — vlevo seznam, vpravo detail.

**Vlevo — seznam všech nahrávek:**

- Co se právě zpracovává nebo čeká ve frontě, je **nahoře, modře zvýrazněné** a s ukazatelem průběhu a odhadem zbývajícího času. Pod tím jsou hotové nahrávky od nejnovější
- **Vyhledávací pole** hledá v názvech chatů **i uvnitř přepisů a shrnutí**. Když se výraz najde v textu, ukáže se pod nahrávkou úryvek
- **Filtry Vše / Zpracovává se / Video / Bez přepisu** zúží seznam
- **Rychlé akce** — po najetí myší na položku se vpravo objeví ikony **Otevřít chat této nahrávky** a **Smazat nahrávku** (smazání se nejdřív zeptá na potvrzení)
- Když se něco zpracovává, objeví se nad seznamem ovládání fronty — **Pozastavit** a **Zrušit vše**

**Vpravo — detail vybrané nahrávky:**

- Nahoře název, datum, délka, typ (Audio / Video), použitý Whisper model a odznaky **MP4 / Schůzka** (že je hotový přepis nebo shrnutí poznáte přímo z obsahu záložek)
- Pod tím vpravo **ikona koše** pro smazání nahrávky (a během zpracování tlačítka **Zrušit** / **Zkusit znovu**)
- Dole záložky a na konci jejich řady **Soubory** — vypadá jako další záložka, ale rozbalí nabídku (otevřít nahrávku, přepis, shrnutí, MP4, vytvořit či přegenerovat MP4, složka nahrávek):
  - **Shrnutí** — formátovaný text AI shrnutí, tlačítka **Zapsat ke schůzce Plus4U** a **Vygenerovat / Přegenerovat shrnutí**, ikona **voleb** (model a styl jsou předvyplněné podle Nastavení AI, změna platí jen pro toto přegenerování), ikona **tužky** pro úpravu textu (tučně, kurzíva, odrážky, číslovaný seznam, odkaz — odkaz obalí označený text, bez označení se vloží jako adresa) a ikona **sdílení** (**Do chatu** / **Sobě**)
  - **Přepis** — přepis jako dialog s barvami řečníků, tlačítko **Spustit přepis / Přepsat znovu**, ikona **voleb** pro výběr staženého modelu a ikona **sdílení** (**Do chatu** / **Sobě**)
  - **Nahrávka** / **Video** — přehrávač přímo v aplikaci
  - **Schůzka** — jen u nahrávek, které už mají zápis v Plus4U

**Otevření chatu:** po najetí myší na nahrávku v seznamu se vpravo objeví ikona **Otevřít chat této nahrávky**.

**Nahrávky jednoho chatu:** v hlavičce každého chatu je tlačítko **M**, které otevře **Přepisy** zúžené jen na nahrávky z toho chatu. Nad seznamem se ukáže lišta *Jen chat: …* s tlačítkem **Zobrazit vše**.

**Volba modelu a stylu shrnutí:** ikona voleb v tabu Shrnutí nabídne modely od všech poskytovatelů, které máte v **Nastavení AI** nastavené, a styl (Stručný, Detailní, Smart, Vlastní). Volba platí jen pro jedno přegenerování — nastavení aplikace nemění.

**Úprava shrnutí:** ikona tužky otevře editor s tučně, kurzívou, odrážkami, číslováním a odkazy. Po **Uložit shrnutí** se text zapíše do souboru `*.summary.md` u nahrávky, takže se pošle i do chatu nebo ke schůzce.

**Volba modelu přepisu:** ikona voleb v tabu Přepis nabídne jen **stažené** modely. Když není stažený žádný, je ikona zašedlá a tooltip odkáže na **Menu → Minutes → Nastavení přepisů**, kde se model stahuje.

**Smazání nahrávky:** ikona koše vpravo v hlavičce smaže **nahrávku i všechny její soubory** — zvuk nebo video, PCM, přepis, shrnutí, MP4, metadata a vazbu na schůzku. Aplikace se nejdřív zeptá a akci nelze vzít zpět.

**Přehrávání:** audio (`.mp3`) jde přetáčet bez omezení. U sdíleného videa (`.webm`) přetáčení spolehlivě nefunguje — vytvořte přes **Soubory → Vytvořit MP4** verzi MP4, přehrávač ji pak použije automaticky.

Během přepisu se vpravo dole ve zbytku aplikace ukazuje malá **pilulka s průběhem**; kliknutím přepne na tento tab.

### AI shrnutí hovoru

Stejné nastavení jako u chatů (**Nastavení AI** včetně **stylu shrnutí**). Shrnutí vznikne nad hotovým přepisem a může obsahovat jména řečníků. Chcete-li jiný styl, změňte ho v Nastavení AI a v **Přepisy** klikněte **Přegenerovat shrnutí**.

### Kam se ukládá

`Dokumenty/Minutes`

Soubory: audio `.mp3`, sdílené video `.webm`, volitelně export `.mp4`, PCM a `.json` metadata, `.transcript.md` a volitelně `.summary.md`. Nové audio i video nahrávky používají stejný automatický přepis a shrnutí.

V tabu **Přepisy** lze u videonahrávky přes nabídku **Soubory → Vytvořit MP4** vyrobit MP4 (H.264/AAC) pro přehrání mimo Minutes i pro přetáčení v zabudovaném přehrávači. Převod použije systémový FFmpeg, pokud je k dispozici; jinak nabídne jednorázové stažení podpory. Původní WebM se nemění. Během převodu jde akci **zrušit** nebo později **přegenerovat**.

### Právní upozornění

Zákony o nahrávání se liší. **Informujte účastníky** a získejte souhlas tam, kde je to potřeba. Minutes na to upozorní v potvrzení **Nahrávání se chystá spustit** před každým novým nahráváním (při obnovení pozastavené nahrávky se dialog nezobrazí).

### Zvuk nahrávky a oprávnění

Audio i video nahrávka používají zvuk přímo z RingRTC: vzdálený playout a lokální vstup, který Signal posílá do hovoru. Recorder neotevírá vlastní mikrofon ani systémový loopback.

1. **Microphone** je potřeba pro samotný Signal hovor. Když je mikrofon v Signalu ztlumený, lokální větev nahrávky obsahuje ticho.
2. **Screen Recording** je potřeba pouze tehdy, když přes Signal sdílíte obrazovku. Nahrávání žádné druhé snímání obrazovky nespouští.

Příchozí zvuk se bere před operačním systémovým výstupem, takže není závislý na hlasitosti reproduktorů ani na vybraném fyzickém výstupu.

### Režim mikrofonu na macOS (Izolace hlasu)

Během hovoru klikněte v řádku nabídek na **oranžovou ikonu mikrofonu** (nebo **Control Center → Mic Mode**) a zvolte:

- **Standard** — běžné zpracování hlasu
- **Izolace hlasu** (Voice Isolation) — potlačí okolní hluk; vhodné v kanceláři nebo kavárně
- **Široké spektrum** (Wide Spectrum) — zachytí i zvuky v místnosti

Režim lze změnit i uprostřed hovoru. Platí pro to, co slyší ostatní účastníci (nejen nahrávka).

---

## Zápis ke schůzce Plus4U

Hotové AI shrnutí hovoru lze vložit přímo do sekce **Zápis** schůzky ve vašem firemním systému (Plus4U). Původní shrnutí zůstává i v Minutes — do schůzky se přidá jako nový blok na konec zápisu, nic se nepřepisuje.

### Jednorázové nastavení

1. **Menu → Minutes → Nastavení AI** → sekce **Plus4U integrace**
2. Zapněte **Povolit zápis ke schůzkám Plus4U**
3. Vyplňte **Access code 1** a **Access code 2** (přístupové kódy vašeho firemního účtu)
4. Klikněte **Uložit kódy** a pak **Otestovat připojení** — vypíše se, pod kým jste přihlášení

Kódy se ukládají **šifrovaně přes safeStorage operačního systému**, stejně jako API klíče. Přihlašovací token existuje jen v paměti běžící aplikace a nikam se neukládá.

### Odeslání zápisu

1. Počkejte, až je hotové **shrnutí** nahrávky (tab **Přepisy**, Ctrl+Shift+M)
2. Vyberte nahrávku a v tabu **Shrnutí** klikněte **Zapsat ke schůzce Plus4U**
3. Minutes nabídne schůzky z vašeho kalendáře pro den nahrávky a **předvybere tu**, která se s nahrávkou časově překrývá
4. Zkontrolujte náhled textu a klikněte **Vložit zápis**

Den lze v dialogu přepnout, pokud zapisujete dodatečně.

### Tab Schůzka

Po úspěšném zápisu se v detailu nahrávky objeví tab **Schůzka** se základními informacemi — název, den, čas, místo, organizátor a kdy se zápis vložil.

Tlačítka v tabu:

| Tlačítko | Co dělá |
|---|---|
| **Potvrdit zápis ze schůzky** (zelené) | Objeví se jen když máte schůzku vyřešit vy — tedy máte na ni v Plus4U nevyřešenou aktivitu. Po potvrzení se schůzka v Plus4U označí za **vyřešenou** a zmizí vám z úkolů. |
| ikona **sdílení** | Pošle **Zápis** nebo **Přípravu** — u obou na výběr **Do chatu** (ten, ze kterého nahrávka je) nebo **Sobě**. |
| ikona **odkazu** | Otevře schůzku v Plus4U v prohlížeči. |
| ikona **obnovení** | Načte údaje o schůzce i text přípravy znovu — třeba když se schůzka přesunula. |

V tabulce nad tlačítky je kromě dne, času, místa a organizátora i řádek **Zápis provede** (kdo má schůzku v Plus4U uzavřít) a **Účastníci** načtení ze schůzky. Pod tlačítky jsou sekce **Příprava** a **Zápis ze schůzky** — texty přímo z Plus4U. Když je schůzka nemá vyplněné, Minutes to napíšou.

Pokud zápis máte provést vy, objeví se nad tlačítky zelená informace a zelené tlačítko **Potvrdit zápis ze schůzky**.

Vazba se ukládá souborově k nahrávce jako `*.meeting.json`, takže zůstane i po restartu aplikace.

### Navrhnout úkoly

V tabu **Schůzka** je tlačítko **Navrhnout úkoly** (s ikonou AI). AI projde zápis a navrhne, jaké úkoly z něj komu vyplývají — nic si nevymýšlí, vychází jen z textu zápisu.

Návrhy jsou seskupené podle člověka a jdou volně upravit:

1. **Upravit** — název, popis i termín přepíšete přímo v seznamu
2. **Příjemce** — u každého úkolu vyberete chat, kam se má poslat. Minutes ho předvyplní podle jména, pokud ho v kontaktech najdou
3. **Smazat** — ikona koše u úkolu
4. **Přidat** — ikona plus u osoby přidá další úkol jí, tlačítko **Přidat úkol** přidá úkol bez řešitele
5. **Odeslat úkol** — pošle danému člověku formální zprávu, že na něj na základě chatu a zápisu vychází tento úkol
6. **Odeslat všechny** — pošle jednou zprávou všechny úkoly téhož člověka

Návrhy se nikam neukládají — jsou jen podklad pro odeslání. Zavřením nahrávky zmizí.

### Ochrana proti dvojímu vložení

Vložený zápis má v hlavičce název hovoru a čas nahrávky. Když stejný zápis odešlete do téže schůzky podruhé, Minutes to pozná a zeptá se — teprve tlačítko **Vložit znovu** zápis přidá znovu.

---

## Záložky

Uloží odkaz na důležitou zprávu pro rychlý návrat.

1. **Přidat** — pravý klik na zprávu → **Minutes: Přidat do záložek**
2. **Seznam** — tab **Záložky** (ikona záložky v levé liště), **Ctrl+Shift+B** nebo menu Minutes → Záložky
3. **Hledání** — pole nad seznamem hledá v názvu chatu i v textu zprávy
4. Klik na položku → vpravo se zobrazí celá zpráva s autorem a časem. Akce jsou **nahoře pod názvem** stejně jako v Přepisech: tlačítko **Otevřít chat této zprávy** (nebo dvojklik v seznamu) a vpravo **ikona koše**
5. **Rychlé akce** — po najetí myší na položku v seznamu se vpravo objeví dvě ikony: **Otevřít chat této zprávy** a **Odebrat záložku** (stejné ikony jako v Přepisech)
6. **Odebrat záložku** — obě cesty se nejdřív zeptají na potvrzení

---

## Zprávy s kontextem

Pravý klik na zprávu (nebo výběr více zpráv) nabízí:

- **Přeposlat s kontextem** — přeposlání včetně jména autora a času původní zprávy (odlišená ikona i titulek dialogu)
- **Kopírovat s kontextem** — zkopíruje text se stejným kontextem do schránky

Běžné přeposlání a kopírování Signálu zůstávají beze změny.

---

## Nastavení MCP

Lokální MCP server a webhooky pro automatizaci (například AI nástroje nebo skripty). Otevřete **Menu → Minutes → Nastavení MCP**.

- Zapnutí serveru, **port**, **kopírování URL** a jednorázové zobrazení **tokenu** (bez tokenu se server nepřipojí)
- **Povolení hostů** — například `host.docker.internal` pro Docker Desktop; HTTP originy se odvodí automaticky
- Oprávnění nástrojů po úrovních: **Pouze čtení**, **Běžné zápisy**, **Destruktivní zápisy**
- Webhooky na události (hovor, nahrávka, přepis, zpráva)

Okno nastavení lze roztáhnout. S tokenem zacházejte jako s heslem — kdo ho má, může jménem Minutes číst nebo měnit data podle zapnutých oprávnění.

---

## Menu Minutes — přehled

| Položka | Co dělá |
|---------|---------|
| Sumarizovat aktuální chat | Shrnutí otevřeného chatu (Ctrl+Shift+U) |
| Záložky | Tab se seznamem záložek a náhledem zprávy (Ctrl+Shift+B) |
| Přepisy (Minutes) | Tab se seznamem nahrávek, přepisy, shrnutími a přehrávačem (Ctrl+Shift+M, nebo ikona **M** v levé liště) |
| Nastavení AI | Jazyk, styl shrnutí, poskytovatel, model, API klíč / lokální Gemma, Plus4U integrace |
| Nastavení Přepisů (Minutes) | Stažení Whisper modelu |
| Nastavení MCP | Lokální MCP server, token, oprávnění nástrojů a webhooky |
| Příručka | Tato nápověda |
| O Minutes | Úvodní obrazovka s přehledem funkcí |
| Otevřít nahrávky hovorů | Složka s MP3, WebM a volitelně MP4 |
| Otevřít sumarizace chatů | Složka s exporty chatů |
| Zobrazit log | Diagnostika (jen z menu) |

---

## Klávesové zkratky

| Zkratka | Akce |
|---------|------|
| Ctrl+Shift+M | Otevřít Přepisy (Minutes) |
| Ctrl+Shift+U | Sumarizovat aktuální chat |
| Ctrl+Shift+B | Záložky |

---

## Kde jsou data

| Typ | Cesta |
|-----|--------|
| Nahrávky hovorů | `Dokumenty/Minutes` |
| Sumáře chatů | Windows `%APPDATA%\Minutes\minutes\summaries\` · macOS `~/Library/Application Support/Minutes/minutes/summaries/` |
| AI nastavení | `%APPDATA%\Minutes\minutes\ai-settings.json` (macOS: `~/Library/Application Support/Minutes/…`) |
| Přístupové kódy Plus4U | `%APPDATA%\Minutes\minutes\uubt-settings.json` (macOS: `~/Library/Application Support/Minutes/…`) — šifrované |
| Vazba nahrávky na schůzku | `Dokumenty/Minutes/<nahrávka>.meeting.json` |
| Modely Whisper | `%APPDATA%\Minutes\minutes\models\` |
| Lokální LLM (Gemma) | `%APPDATA%\Minutes\minutes\models\llm\` |
| Záložky | `%APPDATA%\Minutes\minutes\` |

Při odinstalaci se data **standardně nemazou**.

---

## Aktualizace aplikace

Minutes **automaticky kontroluje nové verze** cca 8 sekund po startu (jen u nainstalované `.exe` verze, ne ve vývoji).

### Co uvidíte

1. **Horní lišta** (banner):
   - *Je dostupná nová verze …* — nová verze na GitHubu, tlačítko **Stáhnout**
   - *Stahuji Minutes …* — probíhá stahování po kliknutí na Stáhnout
   - *Minutes X je stažen. Restartovat a nainstalovat?* — připraveno k instalaci

2. **Domovská obrazovka dole** — stav verze, **Stáhnout** / **Restartovat a nainstalovat**, Release notes

### Jak aktualizovat

| Situace | Co dělat |
|---------|----------|
| Je nová verze | Klikněte **Stáhnout** (banner nebo dole na domovské stránce) |
| Stažení právě běží | Počkejte — dokončí se samo |
| Verze je stažena | **Restartovat a nainstalovat** v banneru nebo dole na domovské stránce |
| Chcete odložit | **Později** — banner se skryje do restartu aplikace |

Instalátor se stáhne do `%APPDATA%\Minutes\minutes\updates\` a spustí se po kliknutí na instalaci. Minutes se zavře a průvodce dokončíte ručně (SmartScreen u unsigned buildu: *Více informací* → *Přesto spustit*).

**Na macOS** je postup jiný: po kliknutí na instalaci se stažený `.dmg` **otevře** a Minutes se zavře. Přetáhněte **Minutes** do složky **Applications** (přepsání předchozí verze) a aplikaci spusťte znovu. Gatekeeper u nepodepsaného buildu může vyžadovat pravý klik → **Otevřít**.

Auto-update Signalu zůstává vypnuté — Minutes používá vlastní kontrolu přes [GitHub Releases](https://github.com/zmitko-uni/minutes/releases).

### Minutes Beta (testovací build)

Pro testování oprav před vydáním do prod existuje **Minutes Beta** — jde nainstalovat **vedle** běžných Minutes:

| | Minutes (prod) | Minutes Beta |
|---|----------------|--------------|
| Zástupce | Minutes | Minutes Beta |
| Data | `%APPDATA%\Minutes` | `%APPDATA%\Minutes-Beta` |
| Release | [Latest](https://github.com/zmitko-uni/minutes/releases/latest) | pre-release na GitHubu |

Beta stahuje aktualizace jen z beta kanálu — **neporovnává** verzi s prod a neprepíše prod instalaci.

---

## Řešení problémů

Minutes se snaží u chyb rovnou napsat, co se stalo a co udělat — třeba *Vyčerpaný kredit u poskytovatele AI* nebo *Neplatný API klíč*. Původní technický text zůstává dostupný pod odkazem **Technické podrobnosti** u dané chyby a v **Menu → Minutes → Zobrazit log**.

### Přepis nebo shrnutí selhalo

V tabu **Přepisy** je u nahrávky v seznamu jen krátké **Přepis selhal** / **Shrnutí selhalo**; celé vysvětlení je v detailu vpravo, spolu s tlačítkem **Zkusit znovu**.

- **Vyčerpaný kredit u poskytovatele AI** — doplňte kredit u poskytovatele; API klíč je v pořádku
- **Poskytovatel AI odmítá další požadavky** — překročený limit požadavků za minutu, zkuste to za chvíli
- **Neplatný API klíč** — zkontrolujte klíč v **Nastavení AI**
- **Model už není dostupný** — zvolte v **Nastavení AI** jiný model a uložte

### AI shrnutí nefunguje

- Otevřete **Nastavení AI** → **Otestovat summarizaci** (tlačítko je v sekci *Aktivní poskytovatel pro sumarizaci*)
- U cloudu: zkontrolujte API klíč, kredit u poskytovatele a internet
- U Gemini: pokud model hlásí deprecaci, klikněte **Obnovit seznam modelů** a zvolte novější Flash (např. `gemini-3.5-flash-lite`)
- U lokálního Gemma: stáhněte a aktivujte model (**Stáhnout a aktivovat**)
- Ujistěte se, že je zapnuté **Povolit AI shrnutí**

### Shrnutí je v angličtině místo češtiny

- V **Nastavení AI** nastavte **Jazyk shrnutí** na `cs` a uložte
- U lokálního Gemma zkuste větší model (Gemma 4 12B)

### Shrnutí je moc krátké nebo naopak rozvláčné

- V **Nastavení AI** zvolte **Styl shrnutí**: Stručný, Detailní nebo Smart
- U **Vlastní** doplňte instrukce (např. „rozepiš každý úkol“) a uložte
- U hovoru pak v **Přepisy** použijte **Přegenerovat shrnutí**

### Chyba „No sequences left“ (lokální model)

- Restartujte aplikaci a zkuste znovu — jde o dočasný stav načteného modelu

### Runtime „Chybí node-llama-cpp“ / chyba `sleep-promise`

- Aktualizujte Minutes na nejnovější verzi (starší instalátory vynechávaly závislost potřebnou pro lokální model)
- Po aktualizaci znovu otevřete **Nastavení AI** a použijte **Stáhnout a aktivovat**

### Přepis běží na pomalé integrované grafice

- **Nastavení Přepisů (Minutes)** → **Výkon přepisu** → **Grafická karta pro akceleraci** — vyberte diskrétní GPU
- Ověřte indikátor **Akcelerace přepisu** (mělo by ukazovat zvolenou kartu)

### Chyba „available-locales.json not found“ při startu

- Jde o vadný instalátor — nainstalujte novější verzi z GitHub Releases (nebo přejděte zpět na předchozí funkční verzi)

### Přepis hovoru nejde

- Dokončete instalaci Whisperu v **Nastavení Přepisů (Minutes)**
- Sledujte frontu v **Přepisy (Minutes)**

### AI „Opravit přepis“ nic nezměnila / text vypadá stejně

- Pokud model vrátí odmítnutí, shrnutí nebo moc krátký výstup, Minutes **ponechá původní Whisper přepis** (nesmaže ho)
- Zkontrolujte v logu hlášku `discarding AI transcript correction`
- Zkuste jiný model nebo vypněte **Opravit přepis hovoru** v Nastavení AI

### Nahrávání nejde

- Ověřte oprávnění k mikrofonu a že jste v aktivním hovoru
- Na macOS: režim mikrofonu se volí v **Control Center** (oranžová ikona mikrofonu v řádku nabídek), ne v nastavení Minutes

### Export MP4 selhal

- V tabu **Přepisy** zkuste **Soubory → Přegenerovat MP4**, nebo nainstalujte FFmpeg do systému a akci spusťte znovu
- Pokud Minutes nabídne stažení podpory MP4, potvrďte ho jednorázově (ukládá se do dat aplikace, instalátor se tím nezvětší)

### MCP se nepřipojuje

- V **Nastavení MCP** ověřte, že server **Běží**, a zkopírujte aktuální URL i token
- Z Dockeru přidejte `host.docker.internal` mezi povolené hosty

### Skupinový hovor ve velké skupině nezvoní

- Ověřte, že máte zapnuté zvonění v lobby před připojením (ikona zvonku)
- Příjemci se stock Signálem ve skupině ≥ 16 členů nezvoní — potřebují Minutes
- Hovor lze i bez zvonění připojit tlačítkem **Připojit se k hovoru** ve skupině

### Zápis ke schůzce Plus4U nefunguje

- V **Nastavení AI** → **Plus4U integrace** klikněte **Otestovat připojení** — ověří přihlášení
- *Neplatné přístupové kódy* — zkontrolujte oba kódy (Access code 2 se kvůli bezpečnosti nezobrazuje, přepište ho celý)
- **Prázdný seznam schůzek** — přepněte v dialogu datum; nabízejí se jen schůzky z vašeho kalendáře pro daný den, bez zrušených a odmítnutých
- **Tlačítko Zapsat ke schůzce Plus4U je zašedlé** — tlačítko najdete v tabu **Shrnutí**. Zašedlé je, dokud nahrávka nemá hotové **shrnutí** (přepis sám nestačí), nebo dokud v **Nastavení AI → Plus4U integrace** není zapnutá integrace **a uložené oba přístupové kódy** (stačí jeden chybějící a tlačítko zůstane neaktivní). Tooltip nad tlačítkem řekne který případ to je
- Když zápis nelze vložit, podrobnosti najdete v **Menu → Minutes → Zobrazit log**

### Nejde vybrat model přepisu

Ikona voleb v tabu **Přepis** je zašedlá, dokud není stažený aspoň jeden model. Stáhněte ho v **Menu → Minutes → Nastavení přepisů**; pak se v nabídce objeví všechny stažené modely.

### Chybí zelené tlačítko Potvrdit zápis ze schůzky

Tlačítko se ukáže jen tehdy, když schůzku máte vyřešit vy — v Plus4U na ni musíte mít **nevyřešenou aktivitu**. Když jste jen účastník, schůzku uzavírá její řešitel. Klikněte ikonu **obnovení**; pokud se stav změnil, tlačítko se objeví. Jestli Plus4U uzavření přes API odmítne, Minutes to řeknou a schůzku uzavřete ručně v prohlížeči.

### Navrhnout úkoly nic nenavrhlo

- Nahrávka musí mít hotové **shrnutí** — úkoly se čtou z něj, ne z přepisu
- Když zápis žádné konkrétní úkoly neobsahuje, AI záměrně nic nevymyslí; úkoly si přidejte tlačítkem **Přidat úkol**
- **Odeslat úkol** je zašedlé, dokud úkol nemá název a vybraného příjemce

### Log pro podporu

**Menu → Minutes → Zobrazit log**

---

## Soukromí a AI

Při **cloud AI** se text chatu nebo přepisu odesílá na servery zvoleného poskytovatele. Náklady hradíte vy podle ceníku poskytovatele.

Při **lokálním Gemma** a **Whisper přepisu** zůstává audio i text zpracování na vašem počítači.

**Nepoužívejte AI sumarizaci** pro důvěrný obsah bez souhlasu účastníků.

---

## Verze a autor

Minutes je fork Signal Desktop (AGPL-3.0-only).

**Autor:** Ing. Martin Zmítko, Ph.D. — na Signalu `@martinzmitko.01`

**Skupina:** [Připojit se do skupiny](https://signal.group/#CjQKIBP9zkSQgKhZKU8a8CmyyetVnaN2JVJtiFXWLtNOF_WlEhDj2Yr4HQMlB-P5tAEy2sQn) — veřejná Signal skupina pro uživatele Minutes

*Poslední aktualizace příručky: 2026-09-12*
