export { emptyFeed, type Feed } from "../lib/feedState.ts";

// Runs the callback when the page becomes usable again (visible, online, focused), at most once per 2 seconds.
export function onResume(callback: () => void): () => void {
  let last = 0;
  const recover = () => {
    if (document.visibilityState !== "visible" || Date.now() - last < 2000) return;
    last = Date.now();
    callback();
  };
  document.addEventListener("visibilitychange", recover);
  window.addEventListener("online", recover);
  window.addEventListener("pageshow", recover);
  window.addEventListener("focus", recover);
  return () => {
    document.removeEventListener("visibilitychange", recover);
    window.removeEventListener("online", recover);
    window.removeEventListener("pageshow", recover);
    window.removeEventListener("focus", recover);
  };
}
