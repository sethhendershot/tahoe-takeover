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
  if (req.accepts('html')) {
    res.render('meals', { meals: data.meals });
  } else {
    res.json(data.meals);
  }
});

app.post('/meals', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send('Please log in first');
  }
  const { title, protein, carb, fats } = req.body;
  if (!title || protein == null || carb == null || fats == null) {
    return res.status(400).send('All fields required');
  }
  const data = readData();
  const meal = { id: Date.now(), title, protein: parseFloat(protein), carb: parseFloat(carb), fats: parseFloat(fats) };
  data.meals.push(meal);
  writeData(data);
  if (req.accepts('html')) {
    res.redirect('/meals');
  } else {
    res.json({ message: 'Meal added', meal });
  }
});

app.get('/training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  const dayPlan = data.dayPlans.find(p => p.date === selectedDate && p.type === 'training' && p.user === req.session.user) || null;
  res.render('training-day', { meals: data.meals, dayPlan, selectedDate });
});

app.get('/not-training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  res.render('not-training-day', { meals: data.meals });
});

app.get('/check-in-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('check-in-day');
});

app.post('/training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const date = req.body.date || new Date().toISOString().split('T')[0];
  let dayPlan = data.dayPlans.find(p => p.date === date && p.type === 'training' && p.user === req.session.user);
  if (!dayPlan) {
    dayPlan = {
      id: Date.now(),
      date,
      type: 'training',
      user: req.session.user,
      meals: []
    };
    data.dayPlans.push(dayPlan);
  } else {
    dayPlan.meals = []; // reset
  }
  for (let i = 1; i <= 6; i++) {
    dayPlan.meals.push({
      slot: i,
      protein: { amount: parseFloat(req.body['protein' + i]), mealId: req.body['proteinMeal' + i] },
      carbs: { amount: parseFloat(req.body['carbs' + i]), mealId: req.body['carbsMeal' + i] },
      fats: { amount: parseFloat(req.body['fats' + i]), mealId: req.body['fatsMeal' + i] }
    });
  }
  writeData(data);
  res.redirect('/day-plans');
});

app.post('/not-training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const dayPlan = {
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    type: 'not-training',
    user: req.session.user,
    meals: []
  };
  for (let i = 1; i <= 5; i++) {
    dayPlan.meals.push({
      slot: i,
      protein: { amount: parseFloat(req.body['protein' + i]), mealId: req.body['proteinMeal' + i] },
      carbs: { amount: parseFloat(req.body['carbs' + i]), mealId: req.body['carbsMeal' + i] },
      fats: { amount: parseFloat(req.body['fats' + i]), mealId: req.body['fatsMeal' + i] }
    });
  }
  data.dayPlans.push(dayPlan);
  writeData(data);
  res.redirect('/day-plans');
});

app.get('/day-plans', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  res.render('day-plans', { dayPlans: data.dayPlans });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});