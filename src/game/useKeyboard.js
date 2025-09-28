import { useEffect, useRef } from "react";

export default function useKeyboard() {
  const keys = useRef(new Set());

  useEffect(() => {
    const down = (e) => {
      keys.current.add(e.key.toLowerCase());
      // чтобы пробел не прокручивал страницу
      if (e.key === " ") e.preventDefault();
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return keys;
}
