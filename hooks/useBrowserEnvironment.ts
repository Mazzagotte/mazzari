import { useEffect, useState } from "react";

export function useBrowserEnvironment() {
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [systemMotion, setSystemMotion] = useState(false);
  useEffect(() => {
    setCanFullscreen(document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function");
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    setSystemMotion(media.matches);
    const motion = () => setSystemMotion(media.matches);
    const full = () => setFullscreen(!!document.fullscreenElement);
    // Lets CSS pause flap animations while the page is hidden.
    const visibility = () => {
      document.documentElement.dataset.hidden = String(document.visibilityState === "hidden");
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    document.addEventListener("fullscreenchange", full);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
      document.removeEventListener("fullscreenchange", full);
    };
  }, []);
  return { fullscreen, canFullscreen, systemMotion };
}
