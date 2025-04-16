const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const lib = require("./utils");

const app = express();
const port = 3000; // Đổi thành 3000 để khớp

app.use(bodyParser.json());

const server = http.createServer(app);
const io = socketIo(server);

// Lưu trữ mapping giữa key và các socket đang theo dõi
const keySubscribers = {};

// Xử lý WebSocket connection
io.on("connection", (socket) => {
    let subscribedKey = null;

    socket.on("register", async (key) => {
        subscribedKey = key;

        if (!keySubscribers[key]) {
            keySubscribers[key] = new Set();
        }
        keySubscribers[key].add(socket);

        // Gửi giá trị ban đầu
        try {
            const initialValue = await lib.view(key); // Sử dụng lib.view
            if (initialValue) {
                socket.emit("initialValue", initialValue);
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
        if (!key || !value) {
            return res.status(400).send("Key and value are required.");
        }

        const currentValue = await lib.view(key);
        if (currentValue !== value) {
            await lib.write(key, value);

            // Phát sự kiện WebSocket nếu giá trị thay đổi
            if (keySubscribers[key]) {
                for (const socket of keySubscribers[key]) {
                    socket.emit("valueUpdate", value);
                }
            }
        }

        res.send("Data added successfully!");
    } catch (err) {
        console.error("Error in /add:", err);
        res.status(500).send(err.toString());
    }
});

app.post("/set", async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || !value) {
            return res.status(400).send("Key and value are required.");
        }

        await lib.write(key, value);

        // Phát sự kiện WebSocket đến các client đang theo dõi key này
        if (keySubscribers[key]) {
            for (const socket of keySubscribers[key]) {
                socket.emit("valueUpdate", value);
            }
        }

        res.send("Value updated successfully!");
    } catch (err) {
        console.error("Error in /set:", err);
        res.status(500).send(err.toString());
    }
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

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
