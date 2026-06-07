import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GiveawayService, loadGiveawayConfig } from "./src/app/giveawayService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const service = new GiveawayService(loadGiveawayConfig());

service.onEvent((event) => {
  io.emit(event.type, event.payload);
});

app.get("/api/state", (_req, res) => {
  res.json(service.getState());
});

app.post("/api/draw", (req, res) => {
  const count = Number(req.body?.count ?? 1);
  const winners = service.draw(Number.isFinite(count) ? count : 1);
  res.json({ winners, state: service.getState() });
});

io.on("connection", (socket) => {
  socket.emit("state", service.getState());
});

async function main(): Promise<void> {
  httpServer.listen(port, () => {
    console.log(`Dashboard: http://localhost:${port}`);
  });

  try {
    await service.start();
    const state = service.getState();
    console.log(`Connected to Kick chat: #${state.channel}`);
    if (process.env.KICK_CHATROOM_ID) {
      console.log(`Chatroom ID: ${process.env.KICK_CHATROOM_ID}`);
    }
    console.log(`Entry keyword: ${state.entryKeyword}`);
  } catch (error) {
    console.error("Kick chat connection failed:", error);
    console.error("The dashboard is running, but live chat is offline.");
  }
}

process.on("SIGINT", async () => {
  await service.stop();
  process.exit(0);
});

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
