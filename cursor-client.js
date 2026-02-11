const io = require("socket.io-client");
const robot = require("robotjs");
const readline = require("readline");

const SERVER_URL = process.env.DISPLAY_CONNECTION_URL || "http://localhost:3001";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("=== Windows Cursor Client (Trackpad Mode) ===");

rl.question("Display Code (4 digits): ", (code) => {
  start(code.trim());
});

function start(code) {
  const socket = io(SERVER_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  let isDragging = false;
  let lastTapTime = 0;

  socket.on("connect", () => {
    console.log("Connected:", socket.id);

    // Register by code only
    socket.emit("register_cursor_client", { code });
  });

  socket.on("connect_error", (err) => {
    console.log("Connection error:", err.message);
  });

  /* =========================
     Trackpad Command Listener
  ========================= */
  socket.on("remote_command", ({ command, payload }) => {
    switch (command) {
      /* ---------- MOVE ---------- */
      case "touchpad_move": {
        const { dx = 0, dy = 0 } = payload || {};
        const pos = robot.getMousePos();

        const speed = 1.6; // sensitivity
        const smooth = 0.8; // smoothing factor

        robot.moveMouse(
          Math.round(pos.x + dx * speed * smooth),
          Math.round(pos.y + dy * speed * smooth)
        );
        break;
      }

      /* ---------- TAP CLICK ---------- */
      case "touchpad_click": {
        const now = Date.now();

        // Double tap detected
        if (now - lastTapTime < 300) {
          // Start drag
          robot.mouseToggle("down", "left");
          isDragging = true;
          console.log("Drag start");
        } else {
          // Single click
          robot.mouseClick("left");
        }

        lastTapTime = now;
        break;
      }

      /* ---------- DRAG END ---------- */
      case "touchpad_release":
        if (isDragging) {
          robot.mouseToggle("up", "left");
          isDragging = false;
          console.log("Drag end");
        }
        break;

      /* ---------- RIGHT CLICK ---------- */
      case "touchpad_right_click":
        robot.mouseClick("right");
        break;

      /* ---------- SCROLL ---------- */
      case "touchpad_scroll": {
        const { dx = 0, dy = 0 } = payload || {};
        robot.scrollMouse(dx, dy);
        break;
      }
    }
  });

  socket.on("cursor_error", (err) => {
    console.log("Cursor error:", err.message);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
  });
}
