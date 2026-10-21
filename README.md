# MAZZARI No. 1 — Mazzagotte Instrument Company

A personal airport-inspired split-flap smart display built with Next.js, React, TypeScript, and CSS 3D animations. It shows a local clock, today's weather, and sports scores/schedules on an adaptive board with up to 24 columns. Rows are allocated only for active content, including selected sports leagues and personal messages.

Styled in deep forest (#101A12), olive green (#233528), champagne gold (#D8B77B), and warm ivory (#F3E8D0), MAZZARI No. 1 retains all weather, sports, accessibility, and configuration features. **Electromechanical information system. Precision in every flip.** Existing browser preferences and launcher filenames remain compatible.

The design takes its cues from mid-century Italian instruments: deep forest enamel, warm ivory lettering, and restrained champagne trim. The supplied MAZZARI monogram is used on the display and in Settings, with the supplied forest-and-gold logo as the browser favicon. The clean display retains only MAZZARI / No. 1 branding and useful information: no corner labels, taglines, repeated headings, array dimensions, or healthy-feed diagnostics. Controls disappear after five seconds of inactivity; moving the pointer, touching the display, or using the keyboard reveals them. Keyboard-focused controls remain visible, and touch screens retain higher idle contrast. The board does not shift when controls fade. Stale/offline warnings remain visible whenever attention is needed.

Subtle champagne rules separate the clock, combined current-weather/forecast section, each selected sports league, and active personal messages. Dividers do not consume flap rows and are omitted in Message board and Clock only modes.

The physical grid uses only as many columns as the longest line in the current rotation needs, up to 24. All active message pages, game cards and weather alternatives are measured together so columns do not change on every flip. New feed content, settings or message schedules can change the size. Empty rows are removed, and dividers follow their sections. Message wrapping and the Settings preview retain the 24-character maximum.

On phones, tablets and desktops, the complete board scales to the available width and height without scrolling, including in landscape. More rows mean smaller lettering. The labeled phone toolbar stays at the top and hides after five seconds of inactivity. Tap the display to reveal it again. Hidden controls cannot be accidentally activated, and keyboard-focused controls remain visible. Settings stays open until closed; closing it restarts the toolbar timer. Touch controls have larger targets, Settings uses 16px form text to avoid focus zoom on iOS, and phone Settings fills the screen with its own scrolling area. Safe-area insets protect notched-screen edges; browser zoom remains enabled. Fullscreen is shown only when the browser supports it.

Changed characters start in a gentle left-to-right ripple (18 ms between columns); unchanged cells do not animate. Reduced motion bypasses the ripple and mechanical animation.

The clock has a taller first row and larger lettering, except during message-only display. The supplied transparent MAZZARI monogram is served locally as a PNG without external requests or web fonts. Mechanical audio combines a brief filtered contact sound and a muted resonant body, with slight variations and a maximum of one click every 110 ms across the entire board.

Maker branding stays off the instrument face: the supplied monogram appears in the Settings header and browser favicon, with a geometric MAZZAGOTTE.DEV maker credit in Settings' About section. Branding assets are served locally without external fonts or requests.

### Evening and dedicated-screen comfort

Under **Settings > Evening & Screen**, optionally enable:

- **Scheduled evening dimming**: default hours are 21:00–07:00 in your selected city's timezone. Choose hours and 20–80% brightness. Equal hours mean all day; overnight windows and daylight-saving time follow local time. During the window, the instrument face dims and mechanical sound is muted. Settings and controls stay at normal brightness so you can adjust them.
- **Keep screen awake**: requests the browser's Screen Wake Lock while visible, and tries again when the display returns or you interact with it. Settings shows the actual request/release/error state and provides a retry button. Support, permissions and device power-saving policies can limit availability. It is not a burn-in prevention feature.

Both options are off by default, preserving existing screen/power behavior. Clock, messages, favorites and schedules are preserved. Daily feeds refresh promptly when the page becomes visible, regains focus, reconnects, or returns after a long timer gap (such as sleep), while duplicate in-flight refreshes are avoided. Failed refreshes retain the last good data with the existing stale/offline warnings.

### Draw a gesture

Under **Settings > Draw a gesture**, choose a previewed template: heart, smiley face, star, flower, butterfly, coffee cup, love letter (envelope), or cat. Templates are drawn at 32 columns by 20 rows for smoother curves and finer detail. Choosing a template replaces the grid but preserves your caption; every template remains editable. Or clear the 32-column, 20-row grid to make your own drawing. Tap or drag to paint champagne-gold flaps; start a stroke on a filled flap to erase. Keyboard users can Tab to a cell and press Space or Enter to toggle it. An optional caption (up to 24 characters) appears centered below the artwork. The editor grid previews the shape; blank rows and columns stay in place on the display. Drawing board scales to the screen with smaller flaps; text modes retain their 24-column limit.

Choose **Show Drawing board**, then close Settings to reveal it. Under **Display**, optionally return to the Daily board in 30 minutes, 2 hours, or tomorrow at 7 AM in the selected city's timezone. The drawing and timer survive reloads, and the return never deletes the drawing. Weather and sports polling pause while Drawing board is active. Flaps retain the existing ripple animation and reduced-motion behavior.

The draft drawing and up to 20 saved cards are stored per browser and included in settings backups. Existing 16-by-10 drawings are upgraded to 32 by 20 by expanding each original pixel into four flaps, preserving the artwork, caption and return timer. Choose a template again to use its newly detailed version. Older backups without drawings get the heart template; older settings without cards start with an empty collection. This feature does not pair devices or send drawings remotely.

#### Personal cards and surprises

- **Saved cards:** give the draft a name and choose **Save as new card**. **Edit** loads a saved copy into the editor; **Update loaded card** explicitly replaces that saved copy. Changes to the draft never silently change saved cards. Include cards in rotation, then choose **Show saved cards**. Selected cards rotate every 20 seconds only in Drawing board mode. **Show Drawing board** shows the draft instead; if no selected cards remain, playback falls back to the draft.
- **Solid or outline:** choose solid gold or a gold outline. The styled preview shows the result, while the editing grid always keeps the original pixels. Switching styles is non-destructive, including for freehand shapes and templates that already contain thin lines.
- **Reveal effects:** choose a left-to-right sweep, center-outward reveal, or outline-first fill. Reveals happen on card arrival rather than repeating while a card is held. All effects honor reduced motion and existing sound/quiet-hour preferences.
- **Signature:** add up to 24 characters, rendered beneath the other text with a leading dash.
- **Meaningful dates:** countdowns use the selected city's calendar date, showing days until, today, or days since. Anniversaries show completed years together; future anniversary dates show days until. February 29 anniversaries advance on March 1 in non-leap years. Add an optional date label such as **OUR TRIP**. Date text updates as the local calendar changes.
- **One-time surprises:** schedule a saved card for a date/time in the selected city's timezone and a duration of 1, 5, 15, 30, 60 or 120 minutes. Scheduling is independent of the rotation checkbox. A surprise temporarily overrides any board mode; its end restores the underlying mode without changing your settings. Existing timed returns keep counting down underneath. For overlaps, the latest start wins (ties use card ID); any still-active earlier surprise resumes afterward. Use **End surprise** or cancel its schedule to stop it early. Deleting a card cancels its schedule.

Surprises require this browser to be open; there are no push notifications or remote delivery. Reloading or waking during the scheduled window shows only the remaining duration; expired windows are not replayed. Schedules store absolute timestamps, so changing city later does not shift an already scheduled instant. Invalid and nonexistent daylight-saving times are rejected; repeated local times use the first occurrence. Backups preserve schedules, cards, styles, signatures, dates and reveal choices.

### Settings backup and timed messages

**Settings > Backup & Restore** exports a versioned JSON file containing your city, time/weather preferences, each league's favorites, messages, schedules, display mode, and sound/screen preferences. Import validates the file and asks you to confirm replacement before changing anything. Unsupported, malformed, or oversized files (over 1 MB) leave existing settings unchanged. Backups include private messages and location; keep them private. They do not include live feed data or the browser's retained final-score cache. Restore inside the kiosk browser to transfer preferences to its separate profile.

In **Message board** mode, **Return to Daily board** offers 30 minutes, 2 hours, or tomorrow at 7 AM in the selected city's timezone. Choose a duration to start the timer immediately, or select **Stay on Message board** to cancel it. The absolute deadline survives reloads and sleep; reopening after the deadline returns to Daily board immediately. Tomorrow morning follows the local calendar across daylight-saving changes. Changing modes cancels the timer; returning to Daily board never deletes messages. A restored backup keeps its original deadline, not a new duration.

### Favorite-team awareness

Enabled leagues automatically look up the next game in each favorite team's published ESPN schedule when that team has no current scoreboard matchup or eligible retained final. Abbreviations are resolved through the team directory to numeric IDs, avoiding ambiguous college-team URL aliases. The board uses existing rows and shows the matchup plus the local date/start time. When the start time is not announced, it keeps the provider's calendar date and shows **TIME TBD**, rather than converting a placeholder midnight to a false local time. Multiple favorites remain independent; duplicate matchups are shown once. Favorites-only still excludes every unrelated team.

**Keep favorite final scores** offers no retention or 6, 12, 24 (default), or 48 hours. A favorite's final is recorded when this browser first observes the completed game on the scoreboard; ESPN does not reliably supply a final-whistle timestamp. That first-observed time and score survive reloads, and polling does not restart the retention period. When it expires, that final drops out and the next scheduled game can take its place. Live favorite games rank first. Only finals the browser has observed are retained; this is not a historical results archive.

Schedules refresh every five minutes, on manual refresh, and on reconnect/resume. Team schedules are cached server-side for five minutes; live scoreboard polling remains every 30 seconds. If the default schedule has no future matchup, lookup checks remaining season phases and the next season's preseason/regular schedule, using a shared time budget and at most four concurrent schedule requests per league. If a schedule fails, prior data for that exact league/favorite selection is retained and a stale/offline schedule warning appears. Invalid or ambiguous abbreviations are reported as unavailable, not guessed. If no future game is published (including the off-season), no matchup is invented: favorites-only shows **NO FAVORITE GAMES** once lookup succeeds.

## Quick start (Windows / VS Code)

1. Unzip the folder and open it in Visual Studio Code (`File > Open Folder`).
2. Install **Node.js 20.9 or later** if it is not already installed.
3. Open **Terminal > New Terminal**.
4. Run:

   ```powershell
   npm install
   npm run dev
   ```

5. Open **http://localhost:1000** in your browser.
6. Click **SETTINGS** to choose your city, temperature units, sports leagues, favorite teams, sounds, and animation speed. Local time is set automatically from your city.
7. Click **FULLSCREEN** to turn the screen into a display. The browser may require a user interaction before it can play sound; click anywhere on the page if clicks are silent.

### One-click Windows startup

Double-click `start-display.bat` in either the outer extracted folder or the app folder. It checks for Node.js 20.9 or later, installs dependencies if needed, builds the production app, waits for the server to respond, and opens your default browser. The first build needs internet access to install packages and can take a few minutes. Keep the server window open; close it to stop the display.

From a PowerShell terminal in the outer extracted folder:

```powershell
.\start-display.bat
```

For a dedicated screen, double-click `start-kiosk.bat`. It opens **Google Chrome** in kiosk mode using a separate FLAP browser profile. Install Chrome first; press `Alt+F4` to leave kiosk mode. Configure settings in that profile once, since they are separate from your default browser.

Both launchers reuse an already-running FLAP server instead of starting another. If you previously ran `npm run dev`, stop it with `Ctrl+C` in its terminal before using the launcher to switch to production. A different service on port 1000 is reported rather than opened as FLAP. To start without opening a browser, run `.\start-display.bat -NoBrowser`.

To launch FLAP automatically when you sign in to Windows, create a shortcut to `start-display.bat` (or `start-kiosk.bat`), press `Win+R`, enter `shell:startup`, and move the shortcut into the Startup folder. This runs at sign-in, not before login.

## How it works

- **Clock**: browser time, formatted in your selected IANA timezone (default `America/Boise`). No internet necessary.
- **Weather**: Open-Meteo public forecast endpoint, refreshed every 2 minutes in the browser; Next.js server caches each weather request for up to 10 minutes. Default coordinates: Boise, Idaho. Does not use your precise location.
- **Scores**: ESPN's publicly accessible (but **unofficial and not guaranteed stable**) scoreboard and live-game summary endpoints, retrieved server-side to avoid browser cross-origin issues. Feeds refresh every 30 seconds; scores are cached server-side for up to 30 seconds. These are periodic snapshots, not a pitch-by-pitch or second-by-second live stream. Select any combination of **MLB, NFL, college football (CFB), NBA, NHL, and men's college basketball**, or turn them all off with **No sports**. Every selected league has its own simultaneously visible three-row scoreboard. Games rotate independently within each league every 20 seconds, ordered by favorite teams first, then live, scheduled, and final games.
- **Audio**: synthesized click sound using the Web Audio API; no sound files required. Browsers typically require clicking the page once to enable audio.
- **Settings**: saved to your browser `localStorage`; no database, login, account, or API key is needed.
- **Feed health**: weather and each selected sports league show their own status and last successful update time. Failed refreshes retain the last successful data and mark it **STALE**; data older than five minutes is also stale. **OFFLINE** means no successful data is available. The header reports **DEGRADED** if any enabled feed is stale or offline, **CONNECTING** while loading, and **LOCAL** when weather and sports are disabled.
- **Display**: all screen sizes fit the complete board within the available viewport without scrolling. Longer weather descriptions and game details wrap into 24-character pages rather than dropping their remaining words. Detail pages rotate every 10 seconds while the matchup/score stays visible. The game clock/status repeats between detail cards. Each game gets 20 seconds per visit, with additional cards appearing on subsequent visits so other games are not starved.
- **Accessibility**: enable reduced motion in Settings to disable mechanical animation and click sounds; the operating system's reduced-motion preference is also respected. Quiet hours mute sounds according to the board's selected timezone, including overnight schedules. Matching start and end times mute all day.

## Configuration notes

Settings are organized into collapsible Display, Location & Weather, Sports, Personal Messages, Screen & Sound, and Backup & Reset sections. Changes save immediately in this browser; there is no Save button. Team pickers have search and a compact selected-team summary, with manual abbreviations available when needed. Restoring defaults requires confirmation and removes saved messages and preferences, so export a backup first. Escape closes Settings, and keyboard focus stays inside the dialog until it closes.

### Personal messages and display modes

In Settings, choose **Daily board**, **Message board**, or **Clock only**. Add up to 20 personal messages (240 characters each). Enabled messages appear below the daily information or take over the board in Message board mode. Clock only shows time/date without messages. Weather and sports polling pauses outside Daily board mode.

The preview uses the board's exact 24-character wrapping and supported uppercase lettering. Accented Latin letters are simplified and `&` becomes `AND`; unsupported symbols are not displayed. Explicit line breaks are preserved. Long messages continue onto additional pages of up to four rows, rotating every 10 seconds along with other active messages.

Optionally enable a daily time window and expiration date. Both use your selected city's timezone, not the computer's timezone. Windows include the start and exclude the end; overnight windows work, and equal start/end times mean all day. An expiration date includes that entire local calendar day. Disabled, blank and expired messages do not appear. Message board mode falls back to the clock when no messages are active; Daily board does not reserve empty message rows. Messages save automatically in this browser only.

Search for a city in Settings and select a result to set the weather location and timezone together. City search uses Open-Meteo geocoding; manual coordinates, location labels, and timezone fields are not exposed in the simplified panel. Your current city is shown above the search. Existing saved locations remain unchanged until you select another city. Under **Sports leagues**, check one, two, all, or none. Pick favorite teams separately for each selected league, or enter ESPN abbreviations separated by commas if the team service is unavailable. Favorites are retained when a league is disabled. Existing single-league preferences are migrated automatically, including previously disabled sports. Settings are per browser and device; Chrome kiosk mode uses its own persistent profile.

## Sport-specific detail cards

**Favorites only** in Settings limits every league to its saved favorite teams. With no matching games (or no favorites selected for that league), the section quietly reads **NO FAVORITE GAMES**; unrelated games are never substituted. This filters the current scoreboard and does not look up future schedules. Favorites remain saved per league when disabled or after restarting this browser; the kiosk profile stores its own preferences.

**Essential game details only** is enabled by default: score, clock/status, live situations and relevant playoff context stay. Turning it off adds selected game statistics or a final-game standout, not an unfiltered statistics feed. Each mode uses at most three detail cards per game, each fitting one 24-character row. Favorites-only filtering is off by default to preserve existing game visibility.

The existing three-row league sections rotate available information automatically:

- **NFL / CFB**: compact quarter/clock, combined possession and down/distance (`DAL BALL / 3RD/4`), red zone, field position and paired remaining timeouts. Red-zone or fourth-down situations outrank routine details. Full mode can add paired total yards.
- **MLB**: inning/status, combined count/outs/bases (`0-2 / 2 OUT / 1ST 3RD`), current batter and pitcher. Scoring-position runners take priority; late tied or one-run games get a concise context card. Pregame can show each team's probable starting pitcher. Full mode can add last-pitch speed when there is room.
- **NBA / college basketball**: quarter or college half/clock, explicit bonus indicators and remaining timeouts. Full mode can add paired fouls, three-point shooting or a supplied shot clock.
- **NHL**: period/clock, identified power-play team and supplied skater strength (`NYR PP / 5 ON 4`), penalty shots and explicit empty-net indicators. Full mode can add paired shots on goal.
- **Important moments**: penalty shots, power plays, red-zone/fourth-down situations, scoring-position runners, overtime and close final-two-minute situations repeat ahead of secondary cards. Score stays visible; the provider's clock/status remains between cards. No local countdown or extra rows are added, and other games retain their normal turns.
- **Game stages**: upcoming games keep the date and complete local start time together on one line (`NEXT OCT 23 6:00 PM`), or show `TIME TBD` when unannounced. Delayed, suspended, postponed and canceled games show their actual condition instead of an invented upcoming time. Finals retain supplied overtime/shootout distinctions and extra innings. Full mode can show one compact game-performance leader; season leaders are not used.
- **Playoffs**: a confirmed playoff series can show its lead/tie/result and recognized round or game number, with special priority for Game 7. A context slot is reserved even in a busy game. Regular-season series, promotional notes, records, rankings, venue and TV information stay off the board.

Missing fields are omitted rather than guessed; supplied zero counts and timeouts remain visible. Overlong names use a supplied shorter name when possible, otherwise the card is omitted instead of splitting an athlete's name across visits. ESPN may not provide every category for every game, particularly before kickoff, after the final whistle, or for smaller college programs. Live-game summaries are fetched with bounded concurrency and a time budget. If extra details cannot be retrieved, scoreboard data remains visible and full mode includes a **DETAILS UNAVAILABLE** card. Cards are selected by relevance rather than cycling through arbitrary provider statistics or long last-play descriptions.

## Quality notes and known limitations

- First-version mechanical flap simulation: uses 3D CSS and short character-cycling animations, not full physical-dynamics modeling.
- The scoreboard shows one game at a time and rotates through all returned games. Large college slates may take several minutes to cycle.
- The CFB scoreboard requests the FBS group, including unranked teams, rather than ESPN's default ranked-team slate.
- Third-party score feeds may have delays or disappear, especially outside a league's season; ESPN has not provided a formal stable API contract for this endpoint.
- Weather data is not suitable for safety-critical decisions.
- Board animation can be computationally demanding on low-power devices; use a fast browser / lower resolution if needed.
- A 24-column line is inherently compact on the smallest phones. The board scales down to fit every selected section; fewer leagues or a larger screen improve readability.

## Production build

### Cloudflare Workers and GitHub

The cloud deployment uses OpenNext on Cloudflare Workers, with the private GitHub repository as its source. The Worker name is `mazzari`; its custom domain is `https://mazzagotte.dev`. Cloudflare manages the domain's HTTPS certificate. Browser settings remain local to each origin: use Backup & Restore to transfer preferences from localhost to the HTTPS site. Publishing the application does not publish your browser's saved messages.

Cloudflare Workers Builds configuration (repository root):

- Production branch: `main`
- Build command: `npm run build:worker`
- Deploy command: `npm run deploy:worker`
- Node.js: 22.19.0, selected by `.node-version`
- R2 bucket: `mazzari-cache`, private, bound as `NEXT_INC_CACHE_R2_BUCKET`
- Revalidation queue: SQLite Durable Object `DOQueueHandler`, configured in `wrangler.jsonc`

Push changes to `main` to trigger the connected build. The build wrapper selects OpenNext's required `.next` output without changing the Windows launcher's `.next-production` output. Do not run the cloud build beside an active `npm run dev` in the same directory: they both use `.next`. Use Cloudflare's Linux build environment or a separate checkout. Windows OpenNext builds are best-effort; the standard local launcher remains supported.

For a separate checkout:

```powershell
npm ci
npm test
npm run build:worker
npm run check:worker
npm run preview:worker
```

Manual cloud deployment requires `npx wrangler login`, then `npm run deploy:worker` after building. The deploy command also populates the R2 cache with pre-rendered content. Never commit API tokens, Wrangler credentials, `.dev.vars`, or build output. The ignored `.wrangler` directory holds local emulator state. Dependency overrides keep the adapter's transitive Glob and Next.js's PostCSS on patched compatible releases; the lockfile pins the verified graph.

No Workers plan upgrade is required by this configuration. Free-tier request/CPU/build quotas still apply; R2 has a free allowance and usage billing beyond it. Monitor usage in Cloudflare, especially for a public display polling sports feeds. Each viewer gets their own local preferences; this is not a remotely managed shared-message service.

```powershell
npm run typecheck
npm run build
npm start
```

Production output is stored in `.next-production`, separate from the development server's `.next` directory. The Windows launcher rebuilds on each fresh server start so code changes are included.

For development checks, use `npm run typecheck` and `npm test`. The tests use Node's built-in TypeScript stripping and require **Node.js 22.6 or later**; running the application still supports Node.js 20.9 or later.

## Files

- `app/page.tsx`: dashboard, data refresh, smart row formatting, sound
- `components/Flap.tsx`: individual 3D flap
- `components/Board.tsx`: 24 x 12 grid
- `components/SettingsPanel.tsx`: settings interface
- `app/api/weather/route.ts`: weather server route
- `app/api/scores/route.ts`: sports server route
- `app/globals.css`: airport-industrial board design

Weather data by [Open-Meteo](https://open-meteo.com/). Sports data provided by ESPN's publicly accessible scoreboard endpoints; not affiliated with ESPN.
