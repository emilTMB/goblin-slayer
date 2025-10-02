<!-- все содержимое закинуть в папку git/hooks назвать файл pre-commit БЕЗ РАСШИРЕНИЯ и если будет выдавать иероглифы пересохранить в UTF-8 BOM И НЕ ЗАБУДЬ САМ ФАЙЛ ЗАСУНУТЬ В git ignore-->

#!/bin/sh

# Сохраняем stdout в FD 3 (чтобы писать мимо stderr-редиректа)

exec 3>&1

# --- стандартная часть (HEAD/проверка имён) ---

if git rev-parse --verify HEAD >/dev/null 2>&1; then
against=HEAD
else
against=$(git hash-object -t tree /dev/null)
fi

allownonascii=$(git config --type=bool hooks.allownonascii)

# Всё остальное по умолчанию в stderr (как в оригинальном хуке)

exec 1>&2

# Запрет не-ASCII имён

if [ "$allownonascii" != "true" ] &&
test $(git diff-index --cached --name-only --diff-filter=A -z "$against" |
LC_ALL=C tr -d '[ -~]\0' | wc -c) != 0
then
cat <<\EOF
Error: Attempt to add a non-ASCII file name.

This can cause problems if you want to work with people on other platforms.

To be portable it is advisable to rename the file.

If you know what you are doing you can disable this check using:

git config hooks.allownonascii true
EOF
exit 1
fi

# -------- НАПОМИНАЛКА --------

# Включается локальным флагом:

# git config --local intern.enabled true

if git config --local --get intern.enabled >/dev/null 2>&1; then
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  REMINDER_JS="$REPO_ROOT/scripts/local/precommit-reminder.js"
DIALOG_PS="$REPO_ROOT/scripts/local/precommit-dialog.ps1"
  NODE_BIN="$(git config --local --get intern.node || command -v node || true)"

if [ -t 0 ] && [ -t 1 ]; then # Есть TTY (коммит из терминала) — можно спрашивать
if [ -n "$NODE_BIN" ] && [ -f "$REMINDER_JS" ]; then
if ! "$NODE_BIN" "$REMINDER_JS"; then
exit 1
fi
else # Шелл-фоллбэк
printf "🧱 Проверили, что нужные блоки существуют и корректно подключены? 🐈 (y/n) " >&3
if [ -r /dev/tty ]; then read answer </dev/tty; else read answer; fi
case "$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')" in
y|yes|д|да) : ;;
\*) echo "❌ Коммит отменён. 🐀 Проверьте блоки и попробуйте снова." >&3; exit 1 ;;
esac
fi
else # Нет TTY (VS Code и т.п.) — показываем GUI-диалог в Windows
if command -v powershell.exe >/dev/null 2>&1 || command -v powershell >/dev/null 2>&1; then
PS_CMD=$(command -v powershell.exe || command -v powershell)
      if [ -f "$DIALOG_PS" ]; then # WPF-диалог с эмодзи
"$PS_CMD" -NoProfile -ExecutionPolicy Bypass -File "$DIALOG_PS"
rc=$?
      else
        # Классический Popup (эмодзи могут не отображаться)
        "$PS_CMD" -NoProfile -NonInteractive -Command "
\$wshell = New-Object -ComObject WScript.Shell;
\$r = \$wshell.Popup('Проверили, что нужные блоки существуют и корректно подключены?',0,'Проверка перед коммитом',0x24);
if (\$r -eq 6) { exit 0 } else { exit 1 }
"
rc=$?
      fi
      if [ "$rc" -ne 0 ]; then
echo '❌ Коммит отменён: подтвердите проверку блоков и попробуйте снова.' >&3
exit 1
fi
else # Не Windows — просто напоминание и продолжаем
echo "ℹ️ Напоминание: перед коммитом проверьте, что блоки существуют и корректно подключены." >&3
fi
fi
fi

# -------- /НАПОМИНАЛКА --------

# Проверка whitespace

exec git diff-index --check --cached "$against" --
