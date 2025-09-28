import React from "react";
import styles from "./styles/Game.module.scss";
import CanvasGame from "./game/CanvasGame";

export default function App() {
  return (
    <div className={styles.app}>
      <h1 className={styles.title}>Убийца гоблинов</h1>
      <CanvasGame />
      <p className={styles.hint}>
        ВАЖНО - использкуйте английскую раскладку клавиатуры! <br />
        WASD/←↑→↓ — движение • Space — удар • R — перезапуск
      </p>
    </div>
  );
}
