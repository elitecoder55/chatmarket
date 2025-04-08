const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Data storage (in-memory, resets on restart)
let users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
let listings = [
  { id: 1, title: "Used Laptop", price: 300, seller: "Alice" },
  { id: 2, title: "Bike", price: 150, seller: "Bob" }
];
let messages = [];

// API Endpoints
app.get('/users', (req, res) => res.json(users));
app.get('/listings', (req, res) => res.json(listings));
app.post('/listings', (req, res) => {
  const newListing = { id: listings.length + 1, ...req.body };
  listings.push(newListing);
  io.emit('listings', listings);
  res.status(201).json(newListing);
});
app.post('/users', (req, res) => {
  const newUser = { id: users.length + 1, name: req.body.name };
  users.push(newUser);
  io.emit('users', users);
  res.status(201).json(newUser);
});

// Serve a basic response for the root URL
app.get('/', (req, res) => res.send('ChatMarket Server'));

// Socket.IO for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected');
  socket.emit('users', users);
  socket.emit('listings', listings);
  socket.emit('messages', messages);

  socket.on('message', (msg) => {
    const newMsg = { id: messages.length + 1, timestamp: new Date().toLocaleTimeString(), ...msg };
    messages.push(newMsg);
    io.emit('messages', messages); // Broadcast to all connected clients
  });

  socket.on('disconnect', () => console.log('User disconnected'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));