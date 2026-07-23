// Минимальный Telegram-бот для дневника зала.
// Без зависимостей (только встроенный https). Long-polling.
//
// Что делает:
//   1. Ставит кнопку меню «Открыть» (слева снизу от поля ввода) — она запускает мини-приложение.
//   2. На /start присылает приветствие с кнопкой, которая тоже открывает мини-приложение.
//
// Запуск:
//   BOT_TOKEN=<новый токен от @BotFather>  WEBAPP_URL=<https-ссылка на index.html>  node bot.js
// (в Windows PowerShell: $env:BOT_TOKEN="..."; $env:WEBAPP_URL="https://..."; node bot.js)

"use strict";
const https = require("https");

const TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

if (!TOKEN || !WEBAPP_URL) {
  console.error("Задай переменные окружения BOT_TOKEN и WEBAPP_URL.");
  console.error('Пример (PowerShell): $env:BOT_TOKEN="123:ABC"; $env:WEBAPP_URL="https://user.github.io/gym/"; node bot.js');
  process.exit(1);
}
if (!/^https:\/\//i.test(WEBAPP_URL)) {
  console.error("WEBAPP_URL должен начинаться с https:// — Telegram открывает мини-приложения только по HTTPS.");
  process.exit(1);
}

const API = "https://api.telegram.org/bot" + TOKEN + "/";

function call(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(params || {});
    const req = https.request(
      API + method,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error("Ответ не JSON: " + body)); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function handleStart(chatId) {
  await call("sendMessage", {
    chat_id: chatId,
    text:
      "Привет! Это твой дневник тренировок 🏋️\n\n" +
      "Нажми кнопку ниже, либо кнопку «Открыть» слева снизу — откроется мини-приложение.\n" +
      "Задай программу на Пн/Ср/Пт один раз — она повторится во всех неделях.",
    reply_markup: {
      inline_keyboard: [[{ text: "🏋️ Открыть дневник", web_app: { url: WEBAPP_URL } }]],
    },
  });
}

async function main() {
  const me = await call("getMe");
  if (!me.ok) {
    console.error("Не удалось авторизоваться. Проверь BOT_TOKEN. Ответ:", me);
    process.exit(1);
  }
  console.log("Бот @" + me.result.username + " запущен.");

  // Кнопка меню «Открыть» (слева снизу) — запускает мини-приложение
  const mb = await call("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Открыть", web_app: { url: WEBAPP_URL } },
  });
  if (mb.ok) console.log('Кнопка меню «Открыть» настроена на: ' + WEBAPP_URL);
  else console.error("Не удалось поставить кнопку меню:", mb);

  console.log("Жду сообщений... (/start в чате с ботом). Ctrl+C — остановить.");

  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let upd;
    try {
      upd = await call("getUpdates", { offset, timeout: 50 });
    } catch (e) {
      console.error("Сетевая ошибка, повтор через 3с:", e.message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (!upd.ok) {
      console.error("getUpdates вернул ошибку:", upd);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const u of upd.result) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (msg && typeof msg.text === "string" && msg.text.startsWith("/start")) {
        try { await handleStart(msg.chat.id); }
        catch (e) { console.error("Ошибка отправки ответа:", e.message); }
      }
    }
  }
}

main().catch((e) => {
  console.error("Фатальная ошибка:", e);
  process.exit(1);
});
