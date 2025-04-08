const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// In-memory data (resets on server restart)
let users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
let listings = [
  { id: 1, title: "Used Laptop", price: 300, seller: "Alice" },
  { id: 2, title: "Bike", price: 150, seller: "Bob" }
];
let messages = [];

// API endpoints
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

// Negotiation endpoint (AI logic)
app.post('/negotiate', (req, res) => {
  const { price } = req.body;
  const suggestedPrice = Math.round(price * 0.85); // simple AI logic
  res.json({ suggestedPrice });
});

// Root response
app.get('/', (req, res) => res.send('ChatMarket Server'));

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected');
  let userName = "";

  socket.emit('users', users);
  socket.emit('listings', listings);
  socket.emit('messages', messages);

  socket.on('register', (name) => {
    userName = name;
    socket.userName = name;
    console.log(`User registered: ${name}`);
  });

  socket.on('message', (msg) => {
    const newMsg = {
      id: messages.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      ...msg
    };
    messages.push(newMsg);

    for (let [id, s] of io.sockets.sockets) {
      if ([msg.from, msg.to].includes(s.userName)) {
        s.emit('messages', messages.filter(m =>
          (m.from === msg.from && m.to === msg.to) ||
          (m.from === msg.to && m.to === msg.from)
        ));
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${userName}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
