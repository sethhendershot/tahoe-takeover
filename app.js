require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
const dataPath = path.join(__dirname, 'meal-options.json');
const mealsPath = path.join(__dirname, 'meals.json');

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

function readMeals() {
  try {
    const data = fs.readFileSync(mealsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writeMeals(data) {
  fs.writeFileSync(mealsPath, JSON.stringify(data, null, 2));
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
    if (req.accepts('html')) {
      return res.redirect('/');
    } else {
      return res.status(401).send('Please log in first');
    }
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
    return res.status(401).json({ success: false, message: 'Please log in first' });
  }
  const { action, id, title, protein, carb, fats } = req.body;
  const data = readData();
  if (action === 'delete') {
    if (!id) {
      return res.status(400).json({ success: false, message: 'ID required for delete' });
    }
    const index = data.meals.findIndex(m => m.id === parseInt(id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    data.meals.splice(index, 1);
    writeData(data);
    return res.json({ success: true, message: 'Meal deleted successfully' });
  } else {
    // add or update
    if (!title || protein == null || carb == null || fats == null) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    let meal;
    if (id) {
      const existingIndex = data.meals.findIndex(m => m.id === parseInt(id));
      if (existingIndex !== -1) {
        // update
        meal = { ...data.meals[existingIndex], title, protein: parseFloat(protein), carb: parseFloat(carb), fats: parseFloat(fats) };
        data.meals[existingIndex] = meal;
        writeData(data);
        return res.json({ success: true, message: 'Meal updated successfully', meal });
      } else {
        // create with given id (though unlikely)
        meal = { id: parseInt(id), title, protein: parseFloat(protein), carb: parseFloat(carb), fats: parseFloat(fats) };
        data.meals.push(meal);
        writeData(data);
        return res.json({ success: true, message: 'Meal created successfully', meal });
      }
    } else {
      // create new
      meal = { id: Date.now(), title, protein: parseFloat(protein), carb: parseFloat(carb), fats: parseFloat(fats) };
      data.meals.push(meal);
      writeData(data);
      return res.json({ success: true, message: 'Meal added successfully', meal });
    }
  }
});

app.get('/training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  res.render('training-day', { meals: data.meals, selectedDate });
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

app.get('/load-meals', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const date = req.query.date;
  const mealsData = readMeals();
  const dayMeals = mealsData[date] || {};
  res.json(dayMeals);
});

app.post('/update-meal', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { date, mealNum, mealId } = req.body;
  const mealsData = readMeals();
  if (!mealsData[date]) mealsData[date] = {};
  mealsData[date][mealNum] = mealId;
  writeMeals(mealsData);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});