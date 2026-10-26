"use client";
import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { Board } from "../components/Board";
import { Wordmark } from "../components/Wordmark";
import { useScreenAwake } from "../components/useScreenAwake";
import { leagueLabel } from "../lib/config";
import { feedStatus } from "../lib/display";
import { activeMessages, rotatingMessage } from "../lib/messages";
import { eveningActive } from "../lib/evening";
import { safeTime } from "../lib/clock";
import { buildSportsSections, composeBoard } from "../lib/boardContent";
import { useClock } from "../hooks/useClock";
import { useSettings } from "../hooks/useSettings";
import { useControlsVisible } from "../hooks/useControlsVisible";
import { useBrowserEnvironment } from "../hooks/useBrowserEnvironment";
import { useLiveFeeds } from "../hooks/useLiveFeeds";
import { useFavoriteSchedules } from "../hooks/useFavoriteSchedules";
import { useFinals } from "../hooks/useFinals";
import { useMechanicalSound } from "../hooks/useMechanicalSound";
import { Settings2, Maximize, Minimize, RefreshCw, Volume2, VolumeX } from "lucide-react";

// The panel is large and only needed on demand, so it loads when first opened and skips re-renders while closed.
const SettingsPanel = memo(dynamic(() => import("../components/SettingsPanel").then((m) => m.SettingsPanel)));

export default function Home() {
  const [panel, setPanel] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualRefresh, setManualRefresh] = useState(0);
  const [awakeRetry, setAwakeRetry] = useState(0);

  const perSecond = useRef(false);
  const { now, setNow, tick, wakeCount } = useClock(perSecond);
  const { settings, setSettings, ready } = useSettings(now, setNotice);
  const refreshId = manualRefresh + wakeCount;
  const controlsVisible = useControlsVisible(panel);
  const { fullscreen, canFullscreen, systemMotion } = useBrowserEnvironment();
  const { weather, sports, refreshing } = useLiveFeeds(ready, settings, refreshId, setNow);
  const schedules = useFavoriteSchedules(ready, settings, refreshId);
  const finals = useFinals(ready, sports, settings.favoritesByLeague, setNotice);
  const { onFlip, unlockAudio } = useMechanicalSound(settings, setNotice);
  const awakeStatus = useScreenAwake(ready && settings.keepAwake, awakeRetry);
  const enableSound = useCallback(() => unlockAudio(true), [unlockAudio]);
  const closePanel = useCallback(() => setPanel(false), []);
  const retryAwake = useCallback(() => setAwakeRetry((value) => value + 1), []);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error(error);
      setNotice("Fullscreen was blocked by the browser.");
    }
  };

  const reducedMotion = settings.reducedMotion || systemMotion;
  const current = now || new Date(0);
  const evening =
    !!now &&
    eveningActive(settings.eveningDimming, current, settings.timezone, settings.eveningStart, settings.eveningEnd);
  const messages = now ? activeMessages(settings.messages, current, settings.timezone) : [];
  // Re-render every second only when seconds are displayed; otherwise once a minute.
  perSecond.current = settings.showSeconds;
  const message = rotatingMessage(messages, tick);
  const weatherState = feedStatus(
    settings.showWeather || settings.showForecast,
    weather.failed,
    weather.updated,
    current.getTime(),
    1_500_000,
  );
  const minute = Math.floor((now?.getTime() || 0) / 60_000);
  const sportsSections = useMemo(
    () => buildSportsSections(settings, sports, schedules, finals, minute * 60_000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      minute,
    ],
  );
  const sportsStates = sportsSections.map((section) =>
    feedStatus(true, section.feed.failed, section.feed.updated, current.getTime(), 720_000),
  );
  const { layout, clockVisible, aspectRatio } = composeBoard({
    settings,
    now,
    tick,
    weather,
    weatherState,
    sportsSections,
    sportsStates,
    message,
    messages,
  });
  const stageStyle: CSSProperties & { "--fit-width": string } = {
    aspectRatio,
    "--fit-width": `min(100cqw, ${aspectRatio * 100}cqh, 1800px)`,
  };
  const describeFeed = (name: string, state: string, updated: number | null) =>
    `${name}: ${state}${updated && state !== "OFF" ? ` (${safeTime(new Date(updated), settings.timezone, { hour: "numeric", minute: "2-digit" })})` : ""}`;
  const stale = (state: string) => ["STALE", "OFFLINE"].includes(state);

  return (
    <main
      className={`app ${controlsVisible || panel ? "" : "display-idle"}${panel ? " settings-open" : ""}`}
      onPointerDown={() => unlockAudio()}
    >
      <div className={`instrument-face${settings.burnInProtection && !reducedMotion ? " drift" : ""}`}>
        <header className="identity">
          <Wordmark />
          <div className="model-number">
            <span />
            NO. 1
            <span />
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
              reducedMotion={reducedMotion || evening}
              sectionStarts={layout.sectionStarts}
              emphasizeClock={clockVisible}
            />
          </div>
        </div>
        {settings.displayMode === "daily" && (
          <footer className="feed-warnings" role="status">
            {stale(weatherState) && <span>{describeFeed("WEATHER", weatherState, weather.updated)}</span>}
            {sportsSections.map(
              (section, index) =>
                stale(sportsStates[index]) && (
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
                stale(state) && (
                  <span key={`${section.league}-schedule`}>
                    {describeFeed(`${leagueLabel(section.league)} SCHEDULE`, state, section.schedule.updated)}
                  </span>
                )
              );
            })}
          </footer>
        )}
      </div>
      <div className="dim-overlay" style={{ opacity: evening ? 1 - settings.eveningBrightness : 0 }} />
      <div className="topbar">
        <div className="actions">
          {settings.displayMode === "daily" && (
            <button
              title="Refresh information"
              aria-label="Refresh information"
              disabled={refreshing}
              onClick={() => setManualRefresh((value) => value + 1)}
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
          onEnableSound={enableSound}
          onClose={closePanel}
          awakeStatus={awakeStatus}
          onRetryAwake={retryAwake}
        />
      )}
    </main>
  );
}
