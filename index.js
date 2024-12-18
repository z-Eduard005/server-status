// import dotenv from "dotenv";
import express from "express";
import TGBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { get, getDatabase, ref, set } from "firebase/database";

// dotenv.config({ path: ".env.local" });
const port = process.env.PORT || 3000;
const tgbToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = Number(process.env.CHAT_ID) || 0;
const apiPassword = process.env.API_PASSWORD || "";
const allowedIPs = JSON.parse(process.env.ALLOWED_IPS || "[]");
const QUERY_TIMEOUT_DURATION_SEC = 45;
let queryTimeout = null;
let timeoutPromise = null;
const app = express();
app.use(express.json());

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.FIREBASE_DB_URL || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

const getServerStatus = async () => {
  const snapshot = await get(ref(database, "status-server-data/"));
  return snapshot.val();
};

const updateServerStatus = async (status) => {
  await set(ref(database, "status-server-data/"), status);
};

const checkPassword = (req, res, next) => {
  if (req.headers["x-api-password"] === apiPassword) return next();
  return res.status(403).json({ error: "Access denied" });
};

const bot = new TGBot(tgbToken, { polling: true });

// bot.on("message", (msg) => {
//   if (chatId === msg.chat.id && msg.text === "/test")
//     bot.sendMessage(chatId, "I'm active now!");
// });

bot.on("polling_error", (err) => {
  console.error("Polling error:", err);
  bot.stopPolling();
  setTimeout(() => bot.startPolling(), 5000);
});

app.get("/get", checkPassword, async (req, res) => {
  try {
    const serverStatus = await getServerStatus();
    res.json(serverStatus);
  } catch (err) {
    res.status(500).json({ err: "Error reading server status" });
  }
});

app.post("/check", checkPassword, (req, res) => {
  const { ipv4 } = req.body;
  const ok = allowedIPs.some((pc) => pc.ip === ipv4);
  res.json({ ok });
});

app.post("/set", checkPassword, async (req, res) => {
  try {
    const newStatus = req.body;
    if (queryTimeout) {
      clearTimeout(queryTimeout);
      timeoutPromise = null;
    }

    timeoutPromise = new Promise((resolve) => {
      queryTimeout = setTimeout(async () => {
        if (timeoutPromise === null) return;

        try {
          await updateServerStatus({ on: false, ipv4: "" });
        } catch {
          console.error("Error updating server status. Data will be outdated!");
          try {
            await bot.sendMessage(
              chatId,
              "<i><b>Error: Server status - open, but the server itself is closed!</b></i>",
              { parse_mode: "HTML" }
            );
          } catch (err) {
            console.error("Error sending message:", err);
          }
        }
        try {
          await bot.sendMessage(chatId, "<i><b>Server closed!</b></i>", {
            parse_mode: "HTML",
          });
        } catch (err) {
          console.error("Error sending message:", err);
        }
        resolve();
      }, QUERY_TIMEOUT_DURATION_SEC * 1000);
    });

    try {
      const serverOn = (await getServerStatus()).on;
      if (!serverOn)
        bot.sendMessage(
          chatId,
          `<i><b>Join in! Server open on IP:</b></i> ${newStatus.ipv4}:25565`,
          { parse_mode: "HTML" }
        );
    } catch (err) {
      console.error("Error reading server status or sending message:", err);
    }
    await updateServerStatus(newStatus);
    await timeoutPromise;
    res.json(newStatus);
  } catch (err) {
    res.status(500).json({ err: "Error updating server status" });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
