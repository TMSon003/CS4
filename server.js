const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const models = require("./models");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize database
models.init().then(() => {
    console.log("Database initialized");
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// API endpoint to get value
app.get("/get/:key", async (req, res) => {
    const value = await models.view(req.params.key);
    res.send(value || "No value found");
});

// API endpoint to set value
app.get("/set/:key/:value", async (req, res) => {
    await models.write(req.params.key, req.params.value);
    // Emit event through socket.io when data changes
    io.emit("valueChanged", {
        key: req.params.key,
        value: req.params.value,
    });
    res.send("Value set successfully");
});

// API endpoint to display value
app.get("/viewer/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "viewer.html"));
});

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("A client connected");

    socket.on("subscribe", async (key) => {
        console.log(`Client subscribed to key: ${key}`);
        socket.join(key);
        // Send current value to newly connected client
        const value = await models.view(key);
        socket.emit("initialValue", { key, value });
    });

    socket.on("disconnect", () => {
        console.log("A client disconnected");
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
