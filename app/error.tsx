"use client";
import { useEffect } from "react";

// Shown if rendering fails. The display runs unattended, so retry automatically instead of staying blank.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Display crashed", error);
    const timer = setTimeout(reset, 10000);
    return () => clearTimeout(timer);
  }, [error, reset]);
  return (
    <main className="app" role="alert" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <p>The display hit a problem and will restart in a few seconds.</p>
        <button onClick={reset}>Restart now</button>
      </div>
    </main>
  );
}
