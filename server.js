const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const lib = require("./utils");

const app = express();
const port = 8080;

app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIo(server);

// Lưu trữ mapping giữa key và các socket đang theo dõi
const keySubscribers = {};

// Xử lý WebSocket connection
io.on("connection", (socket) => {
    let subscribedKey = null;

    socket.on("register", async (key) => {
        // Lưu key mà client muốn theo dõi
        subscribedKey = key;

        // Thêm socket này vào danh sách theo dõi của key
        if (!keySubscribers[key]) {
            keySubscribers[key] = new Set();
        }
        keySubscribers[key].add(socket);

        // Gửi giá trị ban đầu
        try {
            const initialValue = await db.get(
                `SELECT value FROM keyvalue WHERE key = ?`,
                key,
            );
            if (initialValue) {
                socket.emit("initialValue", initialValue.value);
            } else {
                socket.emit("initialValue", "Key not found");
            }
        } catch (err) {
            console.error(err);
            socket.emit("initialValue", "Error retrieving value");
        }
    });

    // Xử lý khi client ngắt kết nối
    socket.on("disconnect", () => {
        if (subscribedKey && keySubscribers[subscribedKey]) {
            keySubscribers[subscribedKey].delete(socket);
            if (keySubscribers[subscribedKey].size === 0) {
                delete keySubscribers[subscribedKey];
            }
        }
    });
});

app.post("/add", async (req, res) => {
    try {
        const { key, value } = req.body;
        await lib.write(key, value);
        res.send("Insert a new record successfully!");
    } catch (err) {
        res.send(err.toString());
    }
});

app.post("/set", (req, res) => {
    const key = req.body.key;
    const value = req.body.value;

    db.run(
        `INSERT OR REPLACE INTO keyvalue (key, value) VALUES (?, ?)`,
        [key, value],
        function (err) {
            if (err) {
                return res.status(500).send(err.message);
            }

            // Thông báo cho tất cả clients đang theo dõi key này
            if (keySubscribers[key]) {
                for (const socket of keySubscribers[key]) {
                    socket.emit("valueUpdate", value);
                }
            }

            res.redirect(`/viewer/${key}`);
        },
    );
});

app.get("/get/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const value = await lib.view(id);
        res.status(200).send(value);
    } catch (err) {
        res.send(err);
    }
});

app.get("/viewer/:id", (req, res) => {
    const id = req.params.id;
    res.sendFile(path.join(__dirname, "viewer.html"));
});

server.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
