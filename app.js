require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
const dataPath = path.join(__dirname, 'data.json');

// Helper functions
function readData() {
  try {
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { meals: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Routes
app.get('/', (req, res) => {
  res.render('home', { user: req.session.user });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin') {
    if (password === process.env.ADMIN_PASSWORD) {
      req.session.user = 'admin';
      req.session.isAdmin = true;
      res.redirect('/');
    } else {
      res.redirect('/');
    }
  } else if (username) {
    req.session.user = username;
    res.redirect('/');
  } else {
    res.redirect('/');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.redirect('/');
  });
});

// Placeholder for meal planning routes
app.get('/meals', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Please log in first');
  }
  const data = readData();
  res.json(data.meals);
});

app.post('/meals', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Please log in first');
  }
  const newMeal = req.body;
  if (!newMeal.name || !newMeal.date) {
    return res.status(400).send('Meal name and date required');
  }
  const data = readData();
  const meal = { id: Date.now(), ...newMeal };
  data.meals.push(meal);
  writeData(data);
  res.json({ message: 'Meal added', meal });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});