import { useEffect, useState } from "react";

export function useControlsVisible(panelOpen: boolean) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastReveal = 0;
    const reveal = () => {
      // Pointer moves fire constantly; re-arming the hide timer a few times a second is plenty.
      const time = Date.now();
      if (time - lastReveal < 250) return;
      lastReveal = time;
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 5000);
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
  }, [panelOpen]);
  return visible;
}
