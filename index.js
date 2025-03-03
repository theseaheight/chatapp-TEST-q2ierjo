// server.js - All-in-one Node.js chat application
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const crypto = require('crypto');

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Store for users, banned IPs, and user data
const users = {};
const bannedIPs = new Set();
const ipToUsername = {}; // Map IPs to usernames

// Serve HTML directly
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Live Chat App</title>
      <script src="/socket.io/socket.io.js"></script>
      <style>
        :root {
          --primary-color: #5436DA;
          --secondary-color: #EEEDF8;
          --text-color: #333;
          --light-text: #666;
          --border-color: #E0E0E0;
          --hover-color: #F5F5F5;
          --shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }

        body {
          background-color: #F9F9F9;
          color: var(--text-color);
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .container {
          max-width: 1000px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-shadow: var(--shadow);
          background: white;
        }

        .header {
          background-color: white;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h1 {
          color: var(--primary-color);
          font-size: 24px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--primary-color);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .chat-container {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .sidebar {
          width: 250px;
          border-right: 1px solid var(--border-color);
          background-color: white;
          display: flex;
          flex-direction: column;
        }

        .online-users {
          padding: 16px;
          flex: 1;
          overflow-y: auto;
        }

        .sidebar h2 {
          font-size: 16px;
          color: var(--light-text);
          margin-bottom: 12px;
          padding-left: 8px;
        }

        .user-list {
          list-style: none;
        }

        .user-item {
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 4px;
          cursor: pointer;
        }

        .user-item:hover {
          background-color: var(--hover-color);
        }

        .admin-controls {
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }

        .admin-btn {
          width: 100%;
          padding: 8px;
          background-color: var(--secondary-color);
          color: var(--primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .admin-btn:hover {
          background-color: #e5e1f5;
        }

        .chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: #FFFFFF;
        }

        .messages {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 8px;
          position: relative;
          line-height: 1.5;
        }

        .user-message {
          align-self: flex-end;
          background-color: var(--primary-color);
          color: white;
          border-bottom-right-radius: 2px;
        }

        .other-message {
          align-self: flex-start;
          background-color: var(--secondary-color);
          color: var(--text-color);
          border-bottom-left-radius: 2px;
        }

        .system-message {
          align-self: center;
          background-color: #f0f0f0;
          color: var(--light-text);
          font-style: italic;
          padding: 8px 16px;
          font-size: 14px;
          max-width: 90%;
        }

        .message-header {
          font-size: 12px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
        }

        .message-username {
          font-weight: bold;
          margin-right: 8px;
        }

        .message-time {
          color: rgba(255, 255, 255, 0.7);
        }

        .other-message .message-time {
          color: var(--light-text);
        }

        .message-input-container {
          border-top: 1px solid var(--border-color);
          padding: 16px 24px;
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .message-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 16px;
          outline: none;
          resize: none;
          height: 46px;
          max-height: 120px;
          overflow-y: auto;
        }

        .message-input:focus {
          border-color: var(--primary-color);
        }

        .send-btn {
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          height: 46px;
        }

        .send-btn:hover {
          background-color: #4a2dc2;
        }

        /* Modal styles */
        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 100;
          justify-content: center;
          align-items: center;
        }

        .modal-content {
          background-color: white;
          padding: 24px;
          border-radius: 8px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .modal h2 {
          margin-bottom: 16px;
          color: var(--primary-color);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .form-group input {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .modal-btn {
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }

        .cancel-btn {
          background-color: var(--hover-color);
          border: 1px solid var(--border-color);
          color: var(--text-color);
        }

        .submit-btn {
          background-color: var(--primary-color);
          border: none;
          color: white;
        }

        /* Admin panel */
        .admin-panel {
          display: none;
          height: 100%;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .admin-title {
          color: var(--primary-color);
        }

        .close-admin {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: var(--light-text);
        }

        .admin-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 16px;
        }

        .admin-tab {
          padding: 8px 16px;
          cursor: pointer;
          margin-right: 8px;
          border-bottom: 2px solid transparent;
        }

        .admin-tab.active {
          border-color: var(--primary-color);
          color: var(--primary-color);
          font-weight: 500;
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        .user-table {
          width: 100%;
          border-collapse: collapse;
        }

        .user-table th, .user-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .user-table th {
          font-weight: 500;
          color: var(--light-text);
        }

        .ban-btn {
          background-color: #ff4d4f;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        .unban-btn {
          background-color: #52c41a;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }

        .log-table {
          width: 100%;
          border-collapse: collapse;
        }

        .log-table th, .log-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid var(--border-color);
        }

        .log-table th {
          font-weight: 500;
          color: var(--light-text);
        }

        @media (max-width: 768px) {
          .container {
            height: 100%;
            width: 100%;
            max-width: 100%;
          }

          .chat-container {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            height: auto;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
          }

          .messages {
            padding: 16px;
          }

          .message {
            max-width: 90%;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Live Chat</h1>
          <div class="user-info">
            <div class="user-avatar" id="user-avatar"></div>
            <div id="username"></div>
          </div>
        </div>

        <div class="chat-container">
          <div class="sidebar">
            <div class="online-users">
              <h2>Online Users</h2>
              <ul class="user-list" id="user-list"></ul>
            </div>
            <div class="admin-controls">
              <button class="admin-btn" id="admin-login-btn">Admin Panel</button>
            </div>
          </div>

          <div class="chat-area">
            <div class="messages" id="messages"></div>
            <div class="message-input-container">
              <textarea class="message-input" id="message-input" placeholder="Type a message..."></textarea>
              <button class="send-btn" id="send-btn">Send</button>
            </div>
          </div>

          <div class="admin-panel" id="admin-panel">
            <div class="admin-header">
              <h2 class="admin-title">Admin Panel</h2>
              <button class="close-admin" id="close-admin">×</button>
            </div>

            <div class="admin-tabs">
              <div class="admin-tab active" data-tab="users">Users</div>
              <div class="admin-tab" data-tab="banned">Banned IPs</div>
              <div class="admin-tab" data-tab="logs">Logs</div>
            </div>

            <div class="tab-content active" id="users-tab">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>IP Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="users-table-body"></tbody>
              </table>
            </div>

            <div class="tab-content" id="banned-tab">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Username</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="banned-table-body"></tbody>
              </table>
            </div>

            <div class="tab-content" id="logs-tab">
              <table class="log-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                  </tr>
                </thead>
                <tbody id="logs-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Admin Login Modal -->
      <div class="modal" id="admin-modal">
        <div class="modal-content">
          <h2>Admin Login</h2>
          <div class="form-group">
            <label for="admin-password">Password</label>
            <input type="password" id="admin-password">
          </div>
          <div class="modal-actions">
            <button class="modal-btn cancel-btn" id="cancel-admin">Cancel</button>
            <button class="modal-btn submit-btn" id="submit-admin">Login</button>
          </div>
        </div>
      </div>

      <script>
        // Connect to socket.io
        const socket = io();

        // DOM Elements
        const messagesContainer = document.getElementById('messages');
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        const userList = document.getElementById('user-list');
        const usernameElement = document.getElementById('username');
        const userAvatarElement = document.getElementById('user-avatar');
        const adminLoginBtn = document.getElementById('admin-login-btn');
        const adminModal = document.getElementById('admin-modal');
        const adminPassword = document.getElementById('admin-password');
        const submitAdmin = document.getElementById('submit-admin');
        const cancelAdmin = document.getElementById('cancel-admin');
        const adminPanel = document.getElementById('admin-panel');
        const closeAdmin = document.getElementById('close-admin');
        const usersTableBody = document.getElementById('users-table-body');
        const bannedTableBody = document.getElementById('banned-table-body');
        const logsTableBody = document.getElementById('logs-table-body');
        const chatArea = document.querySelector('.chat-area');
        const adminTabs = document.querySelectorAll('.admin-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        // Variables
        let myUsername = '';
        let isAdmin = false;

        // Function to add a message to the chat
        function addMessage(message, sender, isSystem = false) {
          const messageElement = document.createElement('div');

          if (isSystem) {
            messageElement.className = 'message system-message';
            messageElement.textContent = message;
          } else {
            const isMe = sender === myUsername;
            messageElement.className = isMe ? 'message user-message' : 'message other-message';

            const messageHeader = document.createElement('div');
            messageHeader.className = 'message-header';

            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'message-username';
            usernameSpan.textContent = sender;

            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-time';
            const now = new Date();
            timeSpan.textContent = now.getHours().toString().padStart(2, '0') + ':' + 
                                  now.getMinutes().toString().padStart(2, '0');

            messageHeader.appendChild(usernameSpan);
            messageHeader.appendChild(timeSpan);

            const messageContent = document.createElement('div');
            messageContent.textContent = message;

            messageElement.appendChild(messageHeader);
            messageElement.appendChild(messageContent);
          }

          messagesContainer.appendChild(messageElement);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Function to update the user list
        function updateUserList(users) {
          userList.innerHTML = '';

          Object.entries(users).forEach(([id, user]) => {
            const userItem = document.createElement('li');
            userItem.className = 'user-item';
            userItem.textContent = user.username;
            userList.appendChild(userItem);
          });
        }

        // Function to update the admin tables
        function updateAdminTables(users, bannedIPs) {
          // Update users table
          usersTableBody.innerHTML = '';
          Object.entries(users).forEach(([id, user]) => {
            const row = document.createElement('tr');

            const usernameCell = document.createElement('td');
            usernameCell.textContent = user.username;

            const ipCell = document.createElement('td');
            ipCell.textContent = user.ip;

            const actionsCell = document.createElement('td');
            const banBtn = document.createElement('button');
            banBtn.className = 'ban-btn';
            banBtn.textContent = 'Ban';
            banBtn.onclick = () => {
              socket.emit('ban-user', user.ip);
            };

            actionsCell.appendChild(banBtn);

            row.appendChild(usernameCell);
            row.appendChild(ipCell);
            row.appendChild(actionsCell);

            usersTableBody.appendChild(row);
          });

          // Update banned IPs table
          bannedTableBody.innerHTML = '';
          bannedIPs.forEach(data => {
            const row = document.createElement('tr');

            const ipCell = document.createElement('td');
            ipCell.textContent = data.ip;

            const usernameCell = document.createElement('td');
            usernameCell.textContent = data.username || 'Unknown';

            const actionsCell = document.createElement('td');
            const unbanBtn = document.createElement('button');
            unbanBtn.className = 'unban-btn';
            unbanBtn.textContent = 'Unban';
            unbanBtn.onclick = () => {
              socket.emit('unban-user', data.ip);
            };

            actionsCell.appendChild(unbanBtn);

            row.appendChild(ipCell);
            row.appendChild(usernameCell);
            row.appendChild(actionsCell);

            bannedTableBody.appendChild(row);
          });
        }

        // Function to add a log entry
        function addLogEntry(event) {
          const row = document.createElement('tr');

          const timeCell = document.createElement('td');
          const now = new Date();
          timeCell.textContent = now.getHours().toString().padStart(2, '0') + ':' + 
                              now.getMinutes().toString().padStart(2, '0') + ':' + 
                              now.getSeconds().toString().padStart(2, '0');

          const eventCell = document.createElement('td');
          eventCell.textContent = event;

          row.appendChild(timeCell);
          row.appendChild(eventCell);

          logsTableBody.prepend(row);
        }

        // Socket events

        // When connected to the server
        socket.on('connect', () => {
          console.log('Connected to server');
        });

        // When assigned a username
        socket.on('set-username', (username) => {
          myUsername = username;
          usernameElement.textContent = username;
          userAvatarElement.textContent = username.charAt(0).toUpperCase();
          addMessage('Welcome to the chat!', 'System', true);
        });

        // When a user joins the chat
        socket.on('user-joined', (username) => {
          addMessage(`${username} joined the chat`, 'System', true);
        });

        // When a user leaves the chat
        socket.on('user-left', (username) => {
          addMessage(`${username} left the chat`, 'System', true);
        });

        // When a user is banned
        socket.on('user-banned', (username) => {
          addMessage(`${username} has been banned`, 'System', true);
        });

        // When receiving a message
        socket.on('chat-message', (data) => {
          addMessage(data.message, data.username);
        });

        // When receiving updated user list
        socket.on('user-list', (users) => {
          updateUserList(users);
        });

        // When banned
        socket.on('banned', () => {
          addMessage('You have been banned from this chat.', 'System', true);
          messageInput.disabled = true;
          sendBtn.disabled = true;
        });

        // When admin data is updated
        socket.on('admin-data', (data) => {
          if (isAdmin) {
            updateAdminTables(data.users, data.bannedIPs);
            addLogEntry(data.logMessage);
          }
        });

        // Event listeners

        // Send message when button is clicked
        sendBtn.addEventListener('click', () => {
          const message = messageInput.value.trim();
          if (message) {
            socket.emit('send-message', message);
            messageInput.value = '';
          }
        });

        // Send message when Enter key is pressed
        messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
          }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
          this.style.height = 'auto';
          this.style.height = (this.scrollHeight > 120 ? 120 : this.scrollHeight) + 'px';
        });

        // Admin login button
        adminLoginBtn.addEventListener('click', () => {
          adminModal.style.display = 'flex';
        });

        // Admin login submit
        submitAdmin.addEventListener('click', () => {
          const password = adminPassword.value;
          socket.emit('admin-login', password);
          adminModal.style.display = 'none';
          adminPassword.value = '';
        });

        // Admin login response
        socket.on('admin-login-response', (success) => {
          if (success) {
            isAdmin = true;
            adminPanel.style.display = 'block';
            chatArea.style.display = 'none';
            socket.emit('get-admin-data');
          } else {
            alert('Incorrect password!');
          }
        });

        // Cancel admin login
        cancelAdmin.addEventListener('click', () => {
          adminModal.style.display = 'none';
          adminPassword.value = '';
        });

        // Close admin panel
        closeAdmin.addEventListener('click', () => {
          adminPanel.style.display = 'none';
          chatArea.style.display = 'flex';
        });

        // Admin tabs
        adminTabs.forEach(tab => {
          tab.addEventListener('click', () => {
            adminTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.getAttribute('data-tab');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
          });
        });
      </script>
    </body>
    </html>
  `);
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  // Get client IP
  const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                  socket.handshake.address || 
                  socket.request.connection.remoteAddress;

  // Check if IP is banned
  if (bannedIPs.has(clientIP)) {
    socket.emit('banned');
    return;
  }

  // Check if user already has a username from this IP
  let username = ipToUsername[clientIP];

  // If not, generate a random username
  if (!username) {
    username = 'User' + Math.floor(1000 + Math.random() * 9000);
    ipToUsername[clientIP] = username;
  }

  // Add user to users object
  users[socket.id] = {
    username: username,
    ip: clientIP
  };

  // Send username to client
  socket.emit('set-username', username);

  // Broadcast to all other clients that a new user joined
  socket.broadcast.emit('user-joined', username);

  // Send updated user list to all clients
  io.emit('user-list', users);

  // Log the event for admin panel
  const logEvent = `${username} connected (IP: ${clientIP})`;
  emitAdminData(logEvent);

  // Handle chat messages
  socket.on('send-message', (message) => {
    // Check if user is banned (extra check)
    if (bannedIPs.has(clientIP)) {
      socket.emit('banned');
      return;
    }

    // Send message to all clients
    io.emit('chat-message', {
      username: users[socket.id].username,
      message: message
    });

    // Log the event for admin panel
    const logEvent = `${users[socket.id].username} sent a message`;
    emitAdminData(logEvent);
  });

  // Handle admin login
  socket.on('admin-login', (password) => {
    // Check if password is correct
    const isCorrect = password === '0609';
    socket.emit('admin-login-response', isCorrect);

    // Log the event for admin panel
    const logEvent = isCorrect
      ? `Admin login successful from IP: ${clientIP}`
      : `Failed admin login attempt from IP: ${clientIP}`;
    emitAdminData(logEvent);
  });

  // Handle admin data request
  socket.on('get-admin-data', () => {
    // Convert banned IPs set to array with usernames
    const bannedIPsData = Array.from(bannedIPs).map(ip => ({
      ip: ip,
      username: ipToUsername[ip] || 'Unknown'
    }));

    // Send admin data
    socket.emit('admin-data', {
      users: users,
      bannedIPs: bannedIPsData,
      logMessage: 'Admin panel opened'
    });
  });

  // Handle ban user
  socket.on('ban-user', (ip) => {
    // Add IP to banned IPs
    bannedIPs.add(ip);

    // Find all sockets with this IP
    Object.entries(users).forEach(([socketId, user]) => {
      if (user.ip === ip) {
        // Get the socket
        const socketToDisconnect = io.sockets.sockets.get(socketId);
        if (socketToDisconnect) {
          // Send banned message
          socketToDisconnect.emit('banned');

          // Notify others
          io.emit('user-banned', user.username);

          // Disconnect the socket
          socketToDisconnect.disconnect(true);
        }
      }
    });

    // Log the event for admin panel
    const logEvent = `IP ${ip} (${ipToUsername[ip] || 'Unknown'}) was banned`;
    emitAdminData(logEvent);
  });

  // Handle unban user
  socket.on('unban-user', (ip) => {
    // Remove IP from banned IPs
    bannedIPs.delete(ip);

    // Log the event for admin panel
    const logEvent = `IP ${ip} (${ipToUsername[ip] || 'Unknown'}) was unbanned`;
    emitAdminData(logEvent);
  });

  // Handle disconnect
      socket.on('disconnect', () => {
        if (users[socket.id]) {
          const username = users[socket.id].username;

          // Broadcast to all other clients that user left
          socket.broadcast.emit('user-left', username);

          // Log the event for admin panel
          const logEvent = `${username} disconnected`;
          emitAdminData(logEvent);

          // Remove user from users object
          delete users[socket.id];

          // Send updated user list to all clients
          io.emit('user-list', users);
        }
      });
    });
  });

  // Helper function to emit admin data to all admin sockets
  function emitAdminData(logMessage) {
    // Convert banned IPs set to array with usernames
    const bannedIPsData = Array.from(bannedIPs).map(ip => ({
      ip: ip,
      username: ipToUsername[ip] || 'Unknown'
    }));

    // Send admin data to all sockets
    io.emit('admin-data', {
      users: users,
      bannedIPs: bannedIPsData,
      logMessage: logMessage
    });
  }

  // Start the server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });