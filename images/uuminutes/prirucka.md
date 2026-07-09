Desktopová aplikace Signal pro **nahrávání hovorů**, **sumarizaci konverzací** a **AI asistenci** u schůzek a chatů. Signal slouží k běžné komunikaci; Minutes přidává nástroje pro práci se zápisy a shrnutími.



Data zůstávají primárně u vás na disku (nahrávky, exporty). Volitelná AI sumarizace využívá **váš vlastní API klíč** u zvoleného poskytovatele (OpenAI, Gemini, Claude nebo Perplexity).



---



## Rychlý přehled funkcí



| Funkce | Kde ji najdete |

|--------|----------------|

| Sumarizace chatu | Menu chatu, pravý klik na zprávu, menu Minutes |

| Záložky zpráv | Pravý klik na zprávu, menu Minutes → Záložky… |

| Nahrávání hovoru | Obrazovka hovoru — tlačítka Record / Pause / Stop |

| Přepis hovoru (Whisper) | menu Minutes → Sumarizace hovoru… |

| AI nastavení | menu Minutes → Nastavení AI… |

| Příručka | menu Minutes → Příručka Minutes (nebo odkaz na úvodní obrazovce) |

| O Minutes | menu Minutes → O Minutes — návrat na úvodní obrazovku |

| Složky s výstupy | menu Minutes → Otevřít nahrávky hovorů / Otevřít sumarizace chatů |



---



## 1. Sumarizace konverzací



### Co to dělá



- Exportuje vybrané zprávy z chatu do souboru **Markdown** (`.md`) s metadaty (`.json`).

- Volitelně po exportu zavolá **AI API** zvoleného poskytovatele a doplní sekci **AI Summary** (pokud máte nastavený API klíč a zapnuté AI shrnutí).



### Jak spustit



1. **Celý otevřený chat** — menu **Minutes → Sumarizovat aktuální chat** nebo klávesa **Ctrl+Shift+U**.

2. **Od konkrétní zprávy** — pravý klik na zprávu → **Minutes: Sumarizovat odtud**.

3. **Za poslední období** — menu **⋯** v hlavičce chatu → Minutes → **Sumarizovat poslední 1 / 8 / 24 hodin**.

4. **Levý panel** — pravý klik na konverzaci → stejné položky sumarizace.



### Kam se ukládá



`%APPDATA%\uuMinutes-uuminutes\uuMinutes\summaries\`



Soubor obsahuje přepis zpráv a případně AI shrnutí. Po dokončení se zobrazí zelená lišta s potvrzením — bez AI klíče upozorní, že byl uložen jen přepis konverzace. Můžete **odeslat do chatu**, **poslat sobě** nebo **zobrazit soubor**.



### AI sumarizace — nastavení



1. **Menu → Minutes → Nastavení AI…**

2. Vyplňte API klíče u poskytovatelů, které chcete používat (můžete mít uložené klíče pro více poskytovatelů najednou).

3. Zvolte **aktivního poskytovatele** a **model** — ten se používá pro sumarizaci, dokud ho nepřepnete.

4. Zapněte „Povolit AI shrnutí po exportu“ a jazyk shrnutí (výchozí **cs**).

5. **Otestovat aktivního** ověří připojení, **Uložit** uloží nastavení (klíče šifrovaně přes safeStorage OS).



#### Podporovaní poskytovatelé



| Poskytovatel | Kde získat API klíč | Doporučený levný model |

|--------------|---------------------|-------------------------|

| OpenAI (ChatGPT) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `gpt-4o-mini` |

| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-2.0-flash` |

| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `claude-3-5-haiku-latest` |

| Perplexity | [perplexity.ai → API](https://www.perplexity.ai/settings/api) | `sonar` |



**Poznámka:** Předplatné ChatGPT Plus, Claude Pro, Perplexity Pro nebo Cursor **není** totéž co API klíč. Minutes potřebuje API klíč s pay-as-you-go fakturací u poskytovatele.



### Upozornění k AI



Text vybraných zpráv se při zapnuté AI sumarizaci odesílá na servery **zvoleného poskytovatele** podle vašeho účtu a klíče. **Nepoužívejte** tuto funkci pro důvěrný obsah bez souhlasu účastníků konverzace. Náklady na API hradíte vy.



---



## 2. Nahrávání a sumarizace hovorů



### Nahrávání



- Funguje u **1:1 i skupinových** hovorů.

- V obrazovce hovoru (vedle mute) najdete ovládání Minutes:

  - **Record** — spustí nahrávání (loopback + mikrofon); funguje i bez nainstalovaného Whisper rozšíření (uloží se jen MP3)

  - **Pause / Resume** — pozastaví / obnoví bez ukončení (včetně logu řečníků)

  - **Stop** — uloží soubor

- Po **skončení hovoru** se aktivní nahrávka automaticky uloží.

- Během nahrávání Minutes **loguje aktivitu řečníků** ze stejných dat jako Signal UI (ikona aktivního mikrofonu): `localAudioLevel` / `remoteAudioLevel` z Reduxu, pravidlo **level > 0**. Ve skupině navíc ukládá RingRTC **`speakerTime`** (kdo naposledy mluvil). Při **Pause** se log i nahrávka zastaví; po **Resume** pokračují obě synchronně.



### Kam se ukládá



`%APPDATA%\uuMinutes-uuminutes\uuMinutes\recordings\`



Každá nahrávka: soubor **`.mp3`** + **`.json`** s metadaty (chat, čas, délka) + volitelně **`.speaker-activity.json`** (log řečníků pro párování s přepisem).



### Přepis a sumarizace hovoru (Whisper)

Přepis probíhá **po úsecích podle řečníka** (z logu `speaker-activity.json`) — každý úsek se přepíše zvlášť, takže u střídajících se řečníků nejsou věty omylem přiřazené jednomu jménu.

1. **Menu → Minutes → Sumarizace hovoru…**

2. Při prvním použití nainstalujte rozšíření — vyberte **Whisper model** (doporučený je *small*) a stáhněte ho. Model lze kdykoli **změnit** nebo **přeinstalovat** ve stejném dialogu.

3. Po nahrání hovoru se spustí přepis automaticky; výsledek lze dále sumarizovat přes AI (pokud je zapnuté v Nastavení AI).

4. Tlačítkem **Odeslat do chatu** v zelené liště se do konverzace vloží **celý text přepisu** (ne jen odkaz na soubor). U segmentů je uvedeno **jméno řečníka** (pokud byl k dispozici log z nahrávání).

5. **AI sumarizace** nad přepisem využívá stejné jméno řečníka u každé věty — shrnutí může přiřadit úkoly a rozhodnutí konkrétním lidem.



Výchozí jazyk přepisu je **čeština** (`cs`). Přepis probíhá **lokálně** na vašem počítači (Whisper). Do cloudu se při přepisu neposílá audio — pouze pokud explicitně použijete AI sumarizaci nad textem.

**Změna modelu:** v **Sumarizace hovoru…** zvolte jiný model (*base* / *small* / *medium* / *large v3*). Pokud se výchozí model aktualizuje, použijte **Přeinstalovat model**.

**Kvalita přepisu:** Minutes používá VAD filtr (Silero), normalizaci hlasitosti, lepší dekódování Whisperu a volitelně **AI korekci přepisu** v Nastavení AI (opraví zjevné chyby typu „jak se máš“). Nové nahrávky ukládají i bezeztrátový PCM sidecar (`.pcm.f32`) pro přesnější přepis než z MP3.



### Právní upozornění



Zákony o nahrávání hovorů se liší podle jurisdikce. **Informujte účastníky** a získejte souhlas tam, kde je to vyžadováno.



---



## 3. Záložky



### Co to dělá



Uloží odkaz na důležitou zprávu v chatu pro rychlý návrat.



### Jak používat



1. **Přidat** — pravý klik na zprávu → **Minutes: Přidat do záložek**.

2. **Seznam** — **Menu → Minutes → Záložky…** (hned pod Sumarizovat aktuální chat).

3. V dialogu zvolte záložku — aplikace přejde do příslušné konverzace a zprávy.

4. **Odebrat** — v dialogu Záložky u konkrétní položky.



---



## 4. menu Minutes (přehled)



| Položka | Popis |

|---------|--------|

| Sumarizovat aktuální chat | Sumarizace právě otevřeného chatu (Ctrl+Shift+U) |

| Záložky… | Seznam uložených záložek |

| Nastavení AI… | API klíče, aktivní poskytovatel, model, jazyk |

| Sumarizace hovoru… | Instalace Whisper, přepis nahrávek |

| Příručka Minutes | Tato příručka v okně aplikace |

| O Minutes | Znovu zobrazí úvodní obrazovku s dlaždicemi funkcí |

| Zobrazit log… | Log Minutes pro diagnostiku |

| Otevřít nahrávky hovorů | Složka s MP3 nahrávkami |

| Otevřít sumarizace chatů | Složka s exporty chatů |



---



## 5. Klávesové zkratky



| Zkratka | Akce |

|---------|------|

| Ctrl+Shift+U | Sumarizovat aktuální chat |

| Ctrl+Shift+Alt+L | Zobrazit Log Minutes |



---



## 6. Kde jsou data



| Typ | Cesta |

|-----|--------|

| Nahrávky hovorů | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\recordings\` |

| Sumáře chatů | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\summaries\` |

| AI nastavení | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\ai-settings.json` |

| Modely Whisper | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\models\` |

| Záložky | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\` (bookmarks JSON) |



Při odinstalaci aplikace se uživatelská data **standardně nemazou**. Technické názvy složek na disku (`uuMinutes-uuminutes`, `uuMinutes/recordings`…) zůstávají kvůli kompatibilitě s dříve uloženými daty.



---



## 7. Řešení problémů



- **AI nefunguje** — zkontrolujte API klíč aktivního poskytovatele v Nastavení AI, kredit u poskytovatele a připojení k internetu.

- **Nahrávání nejde** — ověřte oprávnění k mikrofonu a že jste v aktivním hovoru.

- **Whisper / sumarizace hovoru** — nejdřív dokončete instalaci rozšíření v Sumarizace hovoru…

- **Log** — menu Minutes → Zobrazit log… nebo Ctrl+Shift+Alt+L



---



## 8. Verze a licence



Minutes je fork Signal Desktop (AGPL-3.0-only). Signal zůstává samostatnou službou; Minutes přidává vlastní rozšíření v adresáři `ts/uuminutes/`.

**Autor:** Ing. Martin Zmítko, Ph.D. — na Signalu `@martinzmitko.01` (vyhledáním jména si mě můžete přidat do kontaktů).



Pro vývojáře a údržbu forku viz `README-UUMINUTES.md` a `docs/FORK-MAINTENANCE.md` v repozitáři projektu.



---



*Poslední aktualizace příručky: 2026-07-09*

