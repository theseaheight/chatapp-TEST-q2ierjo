const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to SQLite database (in-memory for simplicity)
const db = new sqlite3.Database(':memory:');

// Create tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            username TEXT NOT NULL,
            userid TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            userid TEXT NOT NULL,
            profilePicture TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT UNIQUE NOT NULL,
            reason TEXT NOT NULL
        )
    `);
});

// Generate a random username
function generateUsername() {
    return `user${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

// Generate a random user ID
function generateUserId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Generate a random profile picture URL
function generateProfilePicture() {
    const avatars = [
        'https://i.pravatar.cc/150?img=1',
        'https://i.pravatar.cc/150?img=2',
        'https://i.pravatar.cc/150?img=3',
        'https://i.pravatar.cc/150?img=4',
        'https://i.pravatar.cc/150?img=5',
    ];
    return avatars[Math.floor(Math.random() * avatars.length)];
}

// Store active users
const activeUsers = new Map();

// Middleware to check if IP is banned
app.use((req, res, next) => {
    const ip = req.ip;
    db.get('SELECT reason FROM bans WHERE ip = ?', [ip], (err, row) => {
        if (row) {
            res.send(`
                <h1>You are no longer welcome on this site</h1>
                <p>Reason: ${row.reason}</p>
            `);
        } else {
            next();
        }
    });
});

// Serve the chat app
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Discord-like Chat</title>
            <style>
                body {
                    margin: 0;
                    font-family: Arial, sans-serif;
                    display: flex;
                    height: 100vh;
                    background-color: #36393f;
                    color: white;
                }
                .container {
                    display: flex;
                    width: 100%;
                }
                .sidebar {
                    width: 250px;
                    background-color: #2f3136;
                    padding: 10px;
                }
                .main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background-color: #36393f;
                }
                .chat {
                    flex: 1;
                    padding: 10px;
                    overflow-y: auto;
                }
                .online-users {
                    width: 250px;
                    background-color: #2f3136;
                    padding: 10px;
                }
                #message-input {
                    padding: 10px;
                    border: none;
                    background-color: #40444b;
                    color: white;
                    margin-top: 10px;
                }
                #channels, #users {
                    list-style: none;
                    padding: 0;
                }
                #channels li, #users li {
                    padding: 5px;
                    cursor: pointer;
                }
                #channels li:hover, #users li:hover {
                    background-color: #40444b;
                }
                .message {
                    display: flex;
                    margin-bottom: 10px;
                }
                .message img {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    margin-right: 10px;
                }
                .message-content {
                    flex: 1;
                }
                .message-header {
                    display: flex;
                    align-items: center;
                }
                .username {
                    font-weight: bold;
                    margin-right: 5px;
                }
                .userid {
                    color: #72767d;
                    font-size: 0.9em;
                }
                .timestamp {
                    color: #72767d;
                    font-size: 0.8em;
                    margin-left: 10px;
                }
                .online-user {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .online-user img {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    margin-right: 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="sidebar">
                    <h2>Channels</h2>
                    <ul id="channels">
                        <li data-channel="general">General</li>
                        <li data-channel="random">Random</li>
                    </ul>
                </div>
                <div class="main">
                    <div class="chat" id="messages"></div>
                    <input type="text" id="message-input" placeholder="Type a message...">
                </div>
                <div class="online-users">
                    <h2>Online Users</h2>
                    <ul id="users"></ul>
                </div>
            </div>
            <script src="/socket.io/socket.io.js"></script>
            <script>
                const socket = io();
                const messagesDiv = document.getElementById('messages');
                const messageInput = document.getElementById('message-input');
                const usersList = document.getElementById('users');
                const channelsList = document.getElementById('channels');

                let currentChannel = 'general';

                // Format timestamp
                function formatTimestamp(date) {
                    const hours = date.getHours() % 12 || 12;
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
                    return \`Today at \${hours}:\${minutes} \${ampm}\`;
                }

                // Load messages for the selected channel
                function loadMessages(channel) {
                    currentChannel = channel;
                    messagesDiv.innerHTML = '';
                    socket.emit('switch channel', channel);
                }

                // Display a new message
                function displayMessage(message) {
                    const messageElement = document.createElement('div');
                    messageElement.className = 'message';
                    messageElement.innerHTML = \`
                        <img src="\${message.profilePicture}" alt="Profile Picture">
                        <div class="message-content">
                            <div class="message-header">
                                <span class="username">\${message.username}</span>
                                <span class="userid">#\${message.userid}</span>
                                <span class="timestamp">\${formatTimestamp(new Date(message.timestamp))}</span>
                            </div>
                            <div>\${message.message}</div>
                        </div>
                    \`;
                    messagesDiv.appendChild(messageElement);
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }

                // Update online users list
                function updateUsers(users) {
                    usersList.innerHTML = users.map(user => \`
                        <li class="online-user">
                            <img src="\${user.profilePicture}" alt="Profile Picture">
                            <div>
                                <div class="username">\${user.username}</div>
                                <div class="userid">#\${user.userid}</div>
                            </div>
                        </li>
                    \`).join('');
                }

                // Event listeners
                channelsList.addEventListener('click', (e) => {
                    if (e.target.tagName === 'LI') {
                        loadMessages(e.target.dataset.channel);
                    }
                });

                messageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && messageInput.value.trim()) {
                        socket.emit('send message', { channel: currentChannel, message: messageInput.value.trim() });
                        messageInput.value = '';
                    }
                });

                // Socket.IO events
                socket.on('load messages', (messages) => {
                    messages.forEach(displayMessage);
                });

                socket.on('receive message', (message) => {
                    if (message.channel === currentChannel) {
                        displayMessage(message);
                    }
                });

                socket.on('user connected', (data) => {
                    updateUsers(data.activeUsers);
                });

                socket.on('user disconnected', (data) => {
                    updateUsers(data.activeUsers);
                });

                socket.on('user banned', (data) => {
                    alert(\`You have been banned. Reason: \${data.reason}\`);
                    window.location.reload();
                });
            </script>
        </body>
        </html>
    `);
});

// Socket.IO logic
io.on('connection', (socket) => {
    const ip = socket.handshake.address;

    // Check if user is banned
    db.get('SELECT reason FROM bans WHERE ip = ?', [ip], (err, row) => {
        if (row) {
            socket.disconnect(true); // Disconnect banned users
            return;
        }

        console.log('a user connected');

        // Assign or retrieve username, user ID, and profile picture
        db.get('SELECT username, userid, profilePicture FROM users WHERE ip = ?', [ip], (err, row) => {
            let username, userid, profilePicture;
            if (row) {
                username = row.username;
                userid = row.userid;
                profilePicture = row.profilePicture;
            } else {
                username = generateUsername();
                userid = generateUserId();
                profilePicture = generateProfilePicture();
                db.run('INSERT INTO users (ip, username, userid, profilePicture) VALUES (?, ?, ?, ?)', [ip, username, userid, profilePicture]);
            }
            activeUsers.set(socket.id, { username, userid, profilePicture, ip });
            io.emit('user connected', { activeUsers: Array.from(activeUsers.values()) });

            // Send existing messages to the user
            db.all('SELECT * FROM messages', (err, rows) => {
                socket.emit('load messages', rows);
            });
        });

        // Handle new messages
        socket.on('send message', (data) => {
            const { channel, message } = data;
            const user = activeUsers.get(socket.id);
            db.run('INSERT INTO messages (channel, username, userid, message) VALUES (?, ?, ?, ?)', [channel, user.username, user.userid, message], (err) => {
                if (err) return console.error(err);
                io.emit('receive message', { channel, ...user, message, timestamp: new Date().toISOString() });
            });
        });

        // Handle user disconnect
        socket.on('disconnect', () => {
            const user = activeUsers.get(socket.id);
            if (user) {
                activeUsers.delete(socket.id);
                io.emit('user disconnected', { activeUsers: Array.from(activeUsers.values()) });
            }
            console.log('user disconnected');
        });

        // Admin command to ban a user
        socket.on('ban user', (data) => {
            const { username, reason } = data;
            const user = Array.from(activeUsers.values()).find(u => u.username === username);
            if (user) {
                db.run('INSERT INTO bans (ip, reason) VALUES (?, ?)', [user.ip, reason], (err) => {
                    if (err) return console.error(err);
                    io.to(socket.id).emit('user banned', { username, reason });
                    io.sockets.sockets.get(socket.id)?.disconnect(true); // Disconnect the banned user
                });
            }
        });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});