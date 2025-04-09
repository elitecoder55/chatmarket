const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

// In-memory data
let users = [];
let listings = [];
let messages = [];
let bids = [];

const superheroPics = [
  'https://cdn.pixabay.com/photo/2017/08/06/21/01/spiderman-2597178_1280.jpg',
  'https://cdn.pixabay.com/photo/2016/04/01/09/09/batman-1299338_1280.png',
  'https://cdn.pixabay.com/photo/2017/08/06/21/01/captain-america-2597180_1280.jpg'
];

// API Endpoints
app.get('/users', (req, res) => res.json(users.map(u => ({ id: u.id, name: u.name }))));
app.get('/listings', (req, res) => res.json(listings));

app.post('/signup', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Username and password required' });
  if (users.some(u => u.name === name)) return res.status(400).json({ error: 'Username already taken' });

  const newUser = { id: users.length + 1, name, password };
  users.push(newUser);
  io.emit('users', users.map(u => ({ id: u.id, name: u.name })));
  res.status(201).json({ message: 'Sign up successful', user: { id: newUser.id, name: newUser.name } });
});

app.post('/signin', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = users.find(u => u.name === name && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ message: 'Sign in successful', user: { id: user.id, name: user.name } });
});

app.post('/listings', (req, res) => {
  const newListing = { id: listings.length + 1, ...req.body, bestOffer: null, winner: null };
  listings.push(newListing);
  io.emit('listings', listings);
  res.status(201).json(newListing);
});

app.post('/negotiate', (req, res) => {
  const { price } = req.body;
  const suggestedPrice = Math.round(price * 0.85);
  res.json({ suggestedPrice });
});

app.get('/superhero-pic', (req, res) => {
  const randomPic = superheroPics[Math.floor(Math.random() * superheroPics.length)];
  res.json({ imageUrl: randomPic });
});

app.post('/upload-image', (req, res) => {
  const { image } = req.body; // Expecting base64 string
  if (!image) return res.status(400).json({ error: 'Image required' });
  // For simplicity, return base64 as-is (in production, save to storage and return URL)
  const imageUrl = image; // Base64 data URL
  res.json({ imageUrl });
});

app.post('/bid', (req, res) => {
  const { listingId, user, amount } = req.body;
  const listing = listings.find(l => l.id === listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (amount > listing.price) return res.status(400).json({ error: 'Bid must be less than or equal to starting price' });

  const existingBid = bids.find(b => b.listingId === listingId && b.user === user);
  if (existingBid) {
    existingBid.amount = amount;
  } else {
    bids.push({ listingId, user, amount });
  }

  const listingBids = bids.filter(b => b.listingId === listingId);
  const bestOffer = listingBids.sort((a, b) => b.amount - a.amount)[0];
  listing.bestOffer = bestOffer ? bestOffer.amount : null;

  io.emit('listings', listings);
  io.emit('bids', bids.filter(b => b.listingId === listingId));
  res.status(201).json({ message: 'Bid placed', bid: { listingId, user, amount } });
});

app.post('/accept-bid', (req, res) => {
  const { listingId, user } = req.body;
  const listing = listings.find(l => l.id === listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.seller !== user) return res.status(403).json({ error: 'Only seller can accept bids' });

  const bestBid = bids.filter(b => b.listingId === listingId).sort((a, b) => b.amount - a.amount)[0];
  if (!bestBid) return res.status(400).json({ error: 'No bids to accept' });

  listing.winner = bestBid.user;
  io.emit('listings', listings);
  res.status(200).json({ message: 'Bid accepted', winner: listing.winner });
});

app.get('/', (req, res) => res.send('ChatMarket Server'));

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('User connected');
  socket.emit('users', users.map(u => ({ id: u.id, name: u.name })));
  socket.emit('listings', listings);
  socket.emit('messages', messages);
  socket.emit('bids', bids);

  socket.on('register', (name) => {
    socket.userName = name;
    console.log(`User registered: ${name}`);
    if (!users.some(u => u.name === name)) {
      const newUser = { id: users.length + 1, name };
      users.push(newUser);
    }
    io.emit('users', users.map(u => ({ id: u.id, name: u.name })));
  });

  socket.on('message', (msg) => {
    const newMsg = {
      id: messages.length + 1,
      timestamp: new Date().toLocaleTimeString(),
      ...msg
    };
    messages.push(newMsg);
    io.emit('messages', messages);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userName}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));