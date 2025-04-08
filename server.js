const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// In-memory storage (resets on restart)
let users = [];
let listings = [];
let messages = [];

// AI Logic for price negotiation
function negotiatePrice(originalPrice) {
  const price = parseFloat(originalPrice);
  if (isNaN(price)) return price;

  // Simple heuristic: apply discounts based on price brackets
  if (price > 1000) return Math.round(price * 0.75); // 25% off
  if (price > 500) return Math.round(price * 0.80); // 20% off
  if (price > 100) return Math.round(price * 0.85); // 15% off
  return Math.round(price * 0.90); // 10% off
}

// API Endpoints
app.get('/users', (req, res) => res.json(users));

app.post('/users', (req, res) => {
  const newUser = { id: Date.now(), name: req.body.name };
  users.push(newUser);
  io.emit('users', users);
  res.status(201).json(newUser);
});

app.get('/listings', (req, res) => res.json(listings));

app.post('/listings', (req, res) => {
  const newListing = { id: Date.now(), ...req.body };
  listings.push(newListing);
  io.emit('listings', listings);
  res.status(201).json(newListing);
});

// New AI route for negotiation
app.post('/negotiate', (req, res) => {
  const { price } = req.body;
  const suggestedPrice = negotiatePrice(price);
  res.json({ suggestedPrice });
});

app.get('/', (req, res) => res.send('ChatMarket Server'));

// Socket.IO setup
io.on('connection', (socket) => {
  console.log('User connected');

  socket.emit('users', users);
  socket.emit('listings', listings);
  socket.emit('messages', messages);

  socket.on('message', (msg) => {
    const newMsg = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      ...msg
    };
    messages.push(newMsg);

    // Emit only to sender and receiver
    io.sockets.sockets.forEach((s) => {
      s.emit('messages', messages.filter(m =>
        (m.from === msg.from && m.to === msg.to) ||
        (m.from === msg.to && m.to === msg.from)
      ));
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
