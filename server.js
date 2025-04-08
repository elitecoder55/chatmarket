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
let users = []; // { id, name, password }
let listings = [];
let messages = [];

// API Endpoints
app.get('/users', (req, res) => res.json(users.map(u => ({ id: u.id, name: u.name })))); // Password hide karna
app.get('/listings', (req, res) => res.json(listings));

// Sign-Up Endpoint
app.post('/signup', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Username and password required' });
  if (users.some(u => u.name === name)) return res.status(400).json({ error: 'Username already taken' });

  const newUser = { id: users.length + 1, name, password };
  users.push(newUser);
  io.emit('users', users.map(u => ({ id: u.id, name: u.name })));
  res.status(201).json({ message: 'Sign up successful', user: { id: newUser.id, name: newUser.name } });
});

// Sign-In Endpoint
app.post('/signin', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = users.find(u => u.name === name && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ message: 'Sign in successful', user: { id: user.id, name: user.name } });
});

app.post('/listings', (req, res) => {
  const newListing = { id: listings.length + 1, ...req.body };
  listings.push(newListing);
  io.emit('listings', listings);
  res.status(201).json(newListing);
});

// Negotiation Endpoint (AI logic)
app.post('/negotiate', (req, res) => {
  const { price } = req.body;
  const suggestedPrice = Math.round(price * 0.85); // Simple AI logic
  res.json({ suggestedPrice });
});

// Root Response
app.get('/', (req, res) => res.send('ChatMarket Server'));

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('User connected');
  let userName = "";

  socket.emit('users', users.map(u => ({ id: u.id, name: u.name })));
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