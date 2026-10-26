"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Board } from "../components/Board";
import { SettingsPanel } from "../components/SettingsPanel";
import { DEFAULTS, League, Settings, leagueLabel, restoreSettings, weatherDescription } from "../lib/config";
import {
  favoriteTeams,
  feedStatus,
  Game,
  gamePages,
  isQuietTime,
  orderGames,
  pages,
  selectGamePage,
} from "../lib/display";
import { isGameFeed, isWeather, Weather } from "../lib/feeds";
import { activeMessages, messagePages, rotatingMessage } from "../lib/messages";
import { boardLayout } from "../lib/boardLayout";
import { eveningActive } from "../lib/evening";
import { createClickBuffer, playMechanicalClick } from "../lib/mechanicalAudio";
import { Wordmark } from "../components/Wordmark";
import { useScreenAwake } from "../components/useScreenAwake";
import { applyMessageReturn } from "../lib/messageReturn";
import { favoriteAwareGames, rememberFinals, restoreFinalCache, type FinalCache } from "../lib/favoriteGames";
import { Settings2, Maximize, Minimize, RefreshCw, Volume2, VolumeX } from "lucide-react";

type Feed<T> = { data: T | null; updated: number | null; failed: boolean };
const emptyFeed = <T,>(): Feed<T> => ({ data: null, updated: null, failed: false });
const safeTime = (date: Date, zone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, ...options }).format(date);

export default function Home() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [weather, setWeather] = useState<Feed<Weather>>(emptyFeed);
  const [sports, setSports] = useState<Partial<Record<League, Feed<Game[]>>>>({});
  const [schedules, setSchedules] = useState<Partial<Record<League, { key: string; feed: Feed<Game[]> }>>>({});
  const [finals, setFinals] = useState<FinalCache>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [systemMotion, setSystemMotion] = useState(false);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [refreshId, setRefreshId] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const clickBuffer = useRef<AudioBuffer | null>(null);
  const [awakeRetry, setAwakeRetry] = useState(0);
  const awakeStatus = useScreenAwake(ready && settings.keepAwake, awakeRetry);
  const lastClick = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reveal = () => {
      setControlsVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setControlsVisible(false), 5000);
    };
    reveal();
    document.addEventListener("pointermove", reveal);
    document.addEventListener("pointerdown", reveal);
    document.addEventListener("keydown", reveal);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointermove", reveal);
      document.removeEventListener("pointerdown", reveal);
      document.removeEventListener("keydown", reveal);
    };
  }, [panel]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("flap-settings");
      if (saved) {
        setSettings(applyMessageReturn(restoreSettings(JSON.parse(saved)), Date.now()));
      }
    } catch (error) {
      console.error("Could not restore display settings", error);
      setNotice("Saved settings could not be loaded. Defaults are active.");
    }
    try {
      const saved = localStorage.getItem("mazzari-finals");
      if (saved) setFinals(restoreFinalCache(JSON.parse(saved), Date.now()));
    } catch (error) {
      console.error("Could not restore final scores", error);
      setNotice("Saved final scores could not be loaded. New finals will still be tracked.");
    }
    setReady(true);
    setCanFullscreen(document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function");
    setNow(new Date());
    let lastClock = Date.now();
    const clock = setInterval(() => {
      const time = Date.now();
      setNow(new Date(time));
      if (time - lastClock > 45000) setRefreshId((value) => value + 1);
      lastClock = time;
    }, 1000);
    const rotation = setInterval(() => setTick((value) => value + 1), 10000);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setSystemMotion(media.matches);
    const motion = () => setSystemMotion(media.matches);
    media.addEventListener("change", motion);
    const full = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", full);
    return () => {
      clearInterval(clock);
      clearInterval(rotation);
      media.removeEventListener("change", motion);
      document.removeEventListener("fullscreenchange", full);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("flap-settings", JSON.stringify(settings));
    } catch (error) {
      console.error("Could not save display settings", error);
      setNotice("Settings could not be saved in this browser.");
    }
  }, [ready, settings]);

  useEffect(() => {
    if (!ready || !now) return;
    setSettings((previous) => applyMessageReturn(previous, now.getTime()));
  }, [ready, now]);

  useEffect(() => {
    if (!ready) return;
    setFinals((previous) => {
      const next = { ...previous };
      for (const league of Object.keys(sports) as League[]) {
        next[league] = rememberFinals(
          previous[league] || [],
          sports[league]?.data || [],
          settings.favoritesByLeague[league],
          Date.now(),
        );
      }
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [ready, sports, settings.favoritesByLeague]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("mazzari-finals", JSON.stringify(finals));
    } catch (error) {
      console.error("Could not save final scores", error);
      setNotice("Final scores could not be saved across reloads in this browser.");
    }
  }, [ready, finals]);

  const scheduleKey = JSON.stringify(
    settings.leagues
      .map((league) => ({ league, teams: favoriteTeams(settings.favoritesByLeague[league]).sort().join(",") }))
      .filter((item) => item.teams),
  );
  useEffect(() => {
    if (!ready || settings.displayMode !== "daily") return;
    const selected: { league: League; teams: string }[] = JSON.parse(scheduleKey);
    const controller = new AbortController();
    let loading = false,
      lastRecovery = 0;
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      await Promise.all(
        selected.map(async ({ league, teams }) => {
          try {
            const response = await fetch(`/api/favorites?league=${league}&teams=${encodeURIComponent(teams)}`, {
              cache: "no-store",
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
            });
            if (!response.ok) throw new Error(`Favorite schedules HTTP ${response.status}`);
            const data: unknown = await response.json();
            if (!isGameFeed(data) || !("errors" in data) || !Array.isArray(data.errors) || data.errors.length)
              throw new Error("Favorite schedules are incomplete or invalid");
            if (!controller.signal.aborted)
              setSchedules((previous) => ({
                ...previous,
                [league]: { key: teams, feed: { data: data.games, updated: Date.now(), failed: false } },
              }));
          } catch (error) {
            if (controller.signal.aborted) return;
            console.error(`Could not update ${league} favorite schedules`, error);
            setSchedules((previous) => ({
              ...previous,
              [league]: {
                key: teams,
                feed: {
                  ...(previous[league]?.key === teams ? previous[league]!.feed : emptyFeed<Game[]>()),
                  failed: true,
                },
              },
            }));
          }
        }),
      );
      loading = false;
    };
    const recover = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRecovery < 2000) return;
      lastRecovery = Date.now();
      void load();
    };
    void load();
    const timer = setInterval(() => void load(), 300000);
    document.addEventListener("visibilitychange", recover);
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    window.addEventListener("focus", recover);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", recover);
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      window.removeEventListener("focus", recover);
    };
  }, [ready, scheduleKey, settings.displayMode, refreshId]);

  const weatherKey = `${settings.lat}/${settings.lon}/${settings.unit}`;
  const previousWeatherKey = useRef(weatherKey);
  useEffect(() => {
    if (!ready) return;
    if (settings.displayMode !== "daily") {
      setRefreshing(false);
      return;
    }
    const controller = new AbortController();
    let loading = false;
    let lastRecovery = 0;
    if (previousWeatherKey.current !== weatherKey) {
      setWeather(emptyFeed());
      previousWeatherKey.current = weatherKey;
    }
    const load = async () => {
      if (loading || controller.signal.aborted) return;
      loading = true;
      setRefreshing(true);
      async function fetchFeed<T>(
        url: string,
        setter: React.Dispatch<React.SetStateAction<Feed<T>>>,
        extract: (value: unknown) => T,
      ) {
        try {
          const response = await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          });
          if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
          const data = extract(await response.json());
          if (!controller.signal.aborted) setter({ data, updated: Date.now(), failed: false });
        } catch (error) {
          if (controller.signal.aborted) return;
          console.error(`Could not update ${url}`, error);
          setter((old) => ({ ...old, failed: true }));
        }
      }
      const requests: Promise<void>[] = [];
      if (settings.showWeather || settings.showForecast)
        requests.push(
          fetchFeed<Weather>(
            `/api/weather?lat=${settings.lat}&lon=${settings.lon}&unit=${settings.unit}`,
            setWeather,
            (value) => {
              if (!isWeather(value)) throw new Error("Invalid weather response");
              return value;
            },
          ),
        );
      for (const league of settings.leagues) {
        const update: React.Dispatch<React.SetStateAction<Feed<Game[]>>> = (next) =>
          setSports((previous) => ({
            ...previous,
            [league]: typeof next === "function" ? next(previous[league] || emptyFeed<Game[]>()) : next,
          }));
        requests.push(
          fetchFeed<Game[]>(`/api/scores?league=${league}`, update, (value) => {
            if (!isGameFeed(value)) throw new Error("Invalid scores response");
            return value.games;
          }),
        );
      }
      await Promise.all(requests);
      loading = false;
      if (!controller.signal.aborted) setRefreshing(false);
    };
    const recover = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRecovery < 2000) return;
      lastRecovery = Date.now();
      setNow(new Date());
      void load();
    };
    void load();
    const interval = setInterval(() => void load(), 30000);
    document.addEventListener("visibilitychange", recover);
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    window.addEventListener("focus", recover);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", recover);
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      window.removeEventListener("focus", recover);
    };
  }, [
    ready,
    weatherKey,
    settings.lat,
    settings.lon,
    settings.unit,
    settings.leagues,
    settings.showWeather,
    settings.showForecast,
    settings.displayMode,
    refreshId,
  ]);

  const reducedMotion = settings.reducedMotion || systemMotion;
  const onFlip = useCallback(() => {
    const s = settingsRef.current;
    if (!s.sound || !s.volume || !audio.current || audio.current.state !== "running") return;
    if (performance.now() - lastClick.current < 110) return;
    lastClick.current = performance.now();
    if (
      s.quietHours &&
      isQuietTime(
        safeTime(new Date(), s.timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
        s.quietStart,
        s.quietEnd,
      )
    )
      return;
    if (eveningActive(s.eveningDimming, new Date(), s.timezone, s.eveningStart, s.eveningEnd)) return;
    const ctx = audio.current;
    if (!clickBuffer.current) clickBuffer.current = createClickBuffer(ctx);
    playMechanicalClick(ctx, clickBuffer.current, s.volume);
  }, []);
  const unlockAudio = (enablingSound = false) => {
    if (!settings.sound && !enablingSound) return;
    try {
      if (!audio.current) audio.current = new AudioContext();
      void audio.current.resume().catch((error) => {
        console.error(error);
        setNotice("Audio could not be enabled.");
      });
    } catch (error) {
      console.error(error);
      setNotice("Audio is unavailable in this browser.");
    }
  };
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error(error);
      setNotice("Fullscreen was blocked by the browser.");
    }
  };

  const current = now || new Date(0);
  const evening =
    !!now &&
    eveningActive(settings.eveningDimming, current, settings.timezone, settings.eveningStart, settings.eveningEnd);
  const messages = now ? activeMessages(settings.messages, current, settings.timezone) : [];
  const message = rotatingMessage(messages, tick);
  const weatherState = feedStatus(
    settings.showWeather || settings.showForecast,
    weather.failed,
    weather.updated,
    current.getTime(),
  );
  const sportsSections = useMemo(
    () =>
      settings.leagues.map((league) => {
        const feed = sports[league] || emptyFeed<Game[]>();
        const favorites = settings.favoritesByLeague[league],
          key = favoriteTeams(favorites).sort().join(",");
        const schedule = schedules[league]?.key === key ? schedules[league]!.feed : emptyFeed<Game[]>();
        const games = orderGames(
          favoriteAwareGames(
            feed.data || [],
            schedule.data || [],
            finals[league] || [],
            favorites,
            settings.finalScoreHours,
            now?.getTime() || 0,
          ),
          favorites,
          settings.favoritesOnly,
        );
        return {
          league,
          feed,
          games,
          schedule,
          hasFavorites: !!key,
          entries: games.map((game) => gamePages(game, settings.timezone, settings.essentialDetails)),
        };
      }),
    [
      settings.leagues,
      settings.favoritesByLeague,
      settings.favoritesOnly,
      settings.essentialDetails,
      settings.finalScoreHours,
      settings.timezone,
      sports,
      schedules,
      finals,
      now,
    ],
  );
  const sportsStates = sportsSections.map((section) =>
    feedStatus(true, section.feed.failed, section.feed.updated, current.getTime()),
  );
  const rotate = (text: string) => {
    const parts = pages(text);
    return parts[tick % parts.length];
  };
  const sectionStarts: number[] = [];
  const lines = [
    now
      ? safeTime(current, settings.timezone, {
          hour: "2-digit",
          minute: "2-digit",
          ...(settings.showSeconds ? { second: "2-digit" } : {}),
          hour12: !settings.time24,
        }).toUpperCase()
      : "STARTING CLOCK",
    now ? safeTime(current, settings.timezone, { weekday: "short", month: "short", day: "numeric" }).toUpperCase() : "",
  ];
  const clockLines = [...lines];
  const rotationLines = [...clockLines];
  const w = weather.data?.current,
    d = weather.data?.daily;
  const unit = settings.unit === "fahrenheit" ? "F" : "C";
  if (settings.showWeather || settings.showForecast) sectionStarts.push(lines.length);
  if (settings.showWeather) {
    if (w)
      rotationLines.push(
        ...pages(`${Math.round(w.temperature_2m)}${unit} ${weatherDescription(w.weather_code)}`),
        `WIND ${Math.round(w.wind_speed_10m)} MPH`,
        `FEELS ${Math.round(w.apparent_temperature)}${unit} HUM ${Math.round(w.relative_humidity_2m)}%`,
      );
    lines.push(
      w
        ? rotate(`${Math.round(w.temperature_2m)}${unit} ${weatherDescription(w.weather_code)}`)
        : `WEATHER ${weatherState}`,
      w
        ? tick % 2
          ? `WIND ${Math.round(w.wind_speed_10m)} MPH`
          : `FEELS ${Math.round(w.apparent_temperature)}${unit} HUM ${Math.round(w.relative_humidity_2m)}%`
        : "",
    );
  }
  if (settings.showForecast) {
    lines.push(
      d
        ? `HIGH ${Math.round(d.temperature_2m_max[0])}${unit} LOW ${Math.round(d.temperature_2m_min[0])}${unit}`
        : `FORECAST ${weatherState}`,
      d ? `RAIN ${Math.round(d.precipitation_probability_max[0])}%` : "",
    );
    rotationLines.push(...lines.slice(-2));
  }
  sportsSections.forEach(({ league, feed, entries, schedule, hasFavorites }, index) => {
    const selection = selectGamePage(entries, tick);
    sectionStarts.push(lines.length);
    lines.push(leagueLabel(league));
    if (selection) {
      rotationLines.push(leagueLabel(league), ...entries.flatMap((entry) => [...entry.matchup, ...entry.status]));
      const entry = entries[selection.index];
      lines.push(
        entry.matchup[selection.page % entry.matchup.length],
        entry.status[selection.page % entry.status.length],
      );
    } else {
      const scheduleState = feedStatus(hasFavorites, schedule.failed, schedule.updated, current.getTime(), 900000);
      lines.push(
        settings.favoritesOnly && hasFavorites && !schedule.data
          ? `SCHEDULE ${scheduleState}`
          : feed.data
            ? settings.favoritesOnly
              ? "NO FAVORITE GAMES"
              : "NO GAMES"
            : `SCORES ${sportsStates[index]}`,
        "",
      );
    }
  });
  if (settings.displayMode === "daily" && message) {
    sectionStarts.push(lines.length);
    lines.push(...message);
  } else if (settings.displayMode === "messages" && message) lines.splice(0, lines.length, ...message);
  else if (settings.displayMode !== "daily") lines.splice(2);
  const messageLines = messages.flatMap((item) => messagePages(item.text).flat());
  const sizingLines =
    settings.displayMode === "daily"
      ? [...rotationLines, ...messageLines]
      : settings.displayMode === "messages" && message
        ? messageLines
        : clockLines;
  const layout = boardLayout(lines, sizingLines, settings.displayMode === "daily" ? sectionStarts : []);
  const rowCount = layout.lines.length;
  const clockVisible = settings.displayMode !== "messages" || !message;
  const aspectRatio = (1.75 * 12 * (layout.columns / 24)) / (rowCount + (clockVisible ? 0.35 : 0));
  const stageStyle: CSSProperties & { "--fit-width": string } = {
    aspectRatio,
    "--fit-width": `min(100cqw, ${aspectRatio * 100}cqh, 1800px)`,
  };
  const describeFeed = (name: string, state: string, updated: number | null) =>
    `${name}: ${state}${updated && state !== "OFF" ? ` (${safeTime(new Date(updated), settings.timezone, { hour: "numeric", minute: "2-digit" })})` : ""}`;

  return (
    <main
      className={`app ${controlsVisible || panel ? "" : "display-idle"}${panel ? " settings-open" : ""}`}
      onPointerDown={() => unlockAudio()}
    >
      <div
        className="instrument-face"
        style={{ filter: evening ? `brightness(${settings.eveningBrightness})` : undefined }}
      >
        <header className="identity">
          <Wordmark />
          <div className="model-number">
            <span />
            NO. 1<span />
          </div>
        </header>
        {notice && (
          <div className="notice" role="alert">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss notification">
              X
            </button>
          </div>
        )}
        <div className="display-area">
          <div className="board-stage" style={stageStyle}>
            <Board
              lines={layout.lines}
              columns={layout.columns}
              speed={settings.speed}
              onFlip={onFlip}
              reducedMotion={reducedMotion}
              sectionStarts={layout.sectionStarts}
              emphasizeClock={clockVisible}
            />
          </div>
        </div>
        {settings.displayMode === "daily" && (
          <footer className="feed-warnings" role="status">
            {["STALE", "OFFLINE"].includes(weatherState) && (
              <span>{describeFeed("WEATHER", weatherState, weather.updated)}</span>
            )}
            {sportsSections.map(
              (section, index) =>
                ["STALE", "OFFLINE"].includes(sportsStates[index]) && (
                  <span key={section.league}>
                    {describeFeed(leagueLabel(section.league), sportsStates[index], section.feed.updated)}
                  </span>
                ),
            )}
            {sportsSections.map((section) => {
              const state = feedStatus(
                section.hasFavorites,
                section.schedule.failed,
                section.schedule.updated,
                current.getTime(),
                900000,
              );
              return (
                ["STALE", "OFFLINE"].includes(state) && (
                  <span key={`${section.league}-schedule`}>
                    {describeFeed(`${leagueLabel(section.league)} SCHEDULE`, state, section.schedule.updated)}
                  </span>
                )
              );
            })}
          </footer>
        )}
      </div>
      <div className="topbar">
        <div className="actions">
          {settings.displayMode === "daily" && (
            <button
              title="Refresh information"
              aria-label="Refresh information"
              disabled={refreshing}
              onClick={() => setRefreshId((value) => value + 1)}
            >
              <RefreshCw size={17} />
              <span>{refreshing ? "SYNCING" : "REFRESH"}</span>
            </button>
          )}
          <button
            title="Toggle audio"
            aria-label="Toggle audio"
            aria-pressed={settings.sound}
            onClick={() => {
              if (!settings.sound) unlockAudio(true);
              setSettings((s) => ({ ...s, sound: !s.sound }));
            }}
          >
            {settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>SOUND</span>
          </button>
          {canFullscreen && (
            <button
              title="Fullscreen"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFull()}
            >
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              <span>FULLSCREEN</span>
            </button>
          )}
          <button className="settings-button" title="Settings" aria-label="Settings" onClick={() => setPanel(true)}>
            <Settings2 size={18} />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>
      {panel && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onEnableSound={() => unlockAudio(true)}
          onClose={() => setPanel(false)}
          awakeStatus={awakeStatus}
          onRetryAwake={() => setAwakeRetry((value) => value + 1)}
        />
      )}
    </main>
  );
}
