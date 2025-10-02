#!/usr/bin/env node

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question =
  "🧱 Проверили, что нужные блоки реально существуют и корректно подключены? (y/n) ";

rl.question(question, (answer) => {
  rl.close();
  const ok = String(answer || "")
    .trim()
    .toLowerCase();
  if (ok === "y" || ok === "yes" || ok === "д" || ok === "да") {
    process.exit(0);
  } else {
    console.error("\n❌ Коммит отменён. Проверьте блоки и попробуйте снова.\n");
    process.exit(1);
  }
});
