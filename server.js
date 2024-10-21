require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

app.use(cors({
  origin: allowedOrigin
}));

const io = socketIo(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});
// const io = socketIo(server, {
//   cors: {
//     origin: "http://localhost:3000",
//     methods: ["GET", "POST"]
//   }
// });

// // Use cors middleware
// app.use(cors());

const PORT = process.env.PORT || 5000;

const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join', ({ roomId, name }) => {
    const room = rooms.get(roomId) || { users: [] };
    
    if (room.users.length >= 2) {
      socket.emit('roomFull');
      return;
    }

    const newUser = { id: socket.id, name };
    room.users.push(newUser);
    rooms.set(roomId, room);
    currentRoom = roomId;

    socket.join(roomId);

    if (room.users.length === 2) {
      const otherUser = room.users.find(user => user.id !== socket.id);
      socket.emit('userJoined', otherUser);
      socket.to(otherUser.id).emit('otherUserJoined', newUser);
    }
  });

  socket.on('offer', ({ to, signal }) => {
    io.to(to).emit('offer', { from: socket.id, signal });
  });

  socket.on('answer', ({ to, signal }) => {
    io.to(to).emit('answer', { from: socket.id, signal });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  const handleDisconnect = () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users = room.users.filter(user => user.id !== socket.id);
        if (room.users.length === 0) {
          rooms.delete(currentRoom);
        } else {
          socket.to(currentRoom).emit('userLeft', socket.id);
        }
      }
    }
  };

  socket.on('disconnect', handleDisconnect);
  socket.on('leaveRoom', handleDisconnect);
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));