const express = require('express');
const session = require('express-session');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    res.send(`Welcome back, ${req.session.user}!`);
  } else {
    res.send('Please log in.');
  }
});

app.post('/login', (req, res) => {
  // Simple login for demo - in real app, verify credentials
  const { username } = req.body;
  if (username) {
    req.session.user = username;
    res.send('Logged in successfully!');
  } else {
    res.status(400).send('Username required');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).send('Could not log out');
    } else {
      res.send('Logged out successfully!');
    }
  });
});

// Placeholder for meal planning routes
app.get('/meals', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Please log in first');
  }
  res.json({ message: 'Meal planning data will be here' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});