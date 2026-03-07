require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
const dataPath = path.join(__dirname, 'meal-options.json');
const mealsPath = path.join(__dirname, 'meals.json');
const guidePath = path.join(__dirname, 'meal-guide.json');
const guidePath = path.join(__dirname, 'meal-guide.json');

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

function readGuide() {
  try {
    const data = fs.readFileSync(guidePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { "non-training": [], "training": [], "check-in": [] };
  }
}

function writeGuide(data) {
  fs.writeFileSync(guidePath, JSON.stringify(data, null, 2));
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

app.get('/meal-guide', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const guide = readGuide();
  res.render('meal-guide', { guide, isAdmin: req.session.isAdmin });
});

app.post('/meal-guide', (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ success: false, message: 'Admin access required' });
  const { action, dayType, meal, protein, carb, fats, note, id } = req.body;
  const guide = readGuide();
  if (!guide[dayType]) guide[dayType] = [];
  if (action === 'add') {
    const newMeal = { meal: parseInt(meal), protein: parseFloat(protein), carb: parseFloat(carb), fats: parseFloat(fats), note: note || '' };
    guide[dayType].push(newMeal);
    writeGuide(guide);
    res.json({ success: true });
  } else if (action === 'edit') {
    const index = guide[dayType].findIndex(m => m.meal === parseInt(id));
    if (index !== -1) {
      guide[dayType][index] = { meal: parseInt(meal), protein: parseFloat(protein), carb: parseFloat(carb), fats: parseFloat(fats), note: note || '' };
      writeGuide(guide);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Meal not found' });
    }
  } else if (action === 'delete') {
    const index = guide[dayType].findIndex(m => m.meal === parseInt(id));
    if (index !== -1) {
      guide[dayType].splice(index, 1);
      writeGuide(guide);
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Meal not found' });
    }
  } else {
    res.status(400).json({ success: false, message: 'Invalid action' });
  }
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
  const mealsData = readMeals();
  let dayPlan = null;
  if (mealsData[selectedDate] && mealsData[selectedDate].type === 'training') {
    dayPlan = { meals: [] };
    for (let i = 1; i <= 6; i++) {
      const meal = mealsData[selectedDate].meals[i] || {};
      dayPlan.meals.push({
        protein: { amount: meal.protein || 0, mealId: meal.proteinMealId || '' },
        carbs: { amount: meal.carbs || 0, mealId: meal.carbsMealId || '' },
        fats: { amount: meal.fats || 0, mealId: meal.fatsMealId || '' }
      });
    }
  }
  res.render('training-day', { meals: data.meals, dayPlan, selectedDate });
});

app.get('/not-training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  const mealsData = readMeals();
  let dayPlan = null;
  if (mealsData[selectedDate] && mealsData[selectedDate].type === 'not-training') {
    dayPlan = { meals: [] };
    for (let i = 1; i <= 5; i++) {
      const meal = mealsData[selectedDate].meals[i] || {};
      dayPlan.meals.push({
        protein: { amount: meal.protein || 0, mealId: meal.proteinMealId || '' },
        carbs: { amount: meal.carbs || 0, mealId: meal.carbsMealId || '' },
        fats: { amount: meal.fats || 0, mealId: meal.fatsMealId || '' }
      });
    }
  }
  res.render('not-training-day', { meals: data.meals, dayPlan, selectedDate });
});

app.get('/check-in-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  const mealsData = readMeals();
  let dayPlan = null;
  if (mealsData[selectedDate] && mealsData[selectedDate].type === 'check-in') {
    dayPlan = { meals: [] };
    for (let i = 1; i <= 6; i++) {
      const meal = mealsData[selectedDate].meals[i] || {};
      dayPlan.meals.push({
        protein: { amount: meal.protein || 0, mealId: meal.proteinMealId || '' },
        carbs: { amount: meal.carbs || 0, mealId: meal.carbsMealId || '' },
        fats: { amount: meal.fats || 0, mealId: meal.fatsMealId || '' }
      });
    }
  }
  res.render('check-in-day', { meals: data.meals, dayPlan, selectedDate });
});

app.post('/training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const mealsData = readMeals();
  const date = req.body.date || new Date().toISOString().split('T')[0];
  if (!mealsData[date]) {
    mealsData[date] = { type: 'training', user: req.session.user, meals: {} };
  } else if (!mealsData[date].meals) {
    mealsData[date].meals = {};
  }
  mealsData[date].type = 'training';
  mealsData[date].user = req.session.user;
  for (let i = 1; i <= 6; i++) {
    mealsData[date].meals[i] = {
      protein: parseFloat(req.body['protein' + i]) || 0,
      carbs: parseFloat(req.body['carbs' + i]) || 0,
      fats: parseFloat(req.body['fats' + i]) || 0,
      proteinMealId: req.body['proteinMeal' + i],
      carbsMealId: req.body['carbsMeal' + i],
      fatsMealId: req.body['fatsMeal' + i]
    };
  }
  writeMeals(mealsData);
  res.redirect('/day-plans');
});

app.post('/not-training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const mealsData = readMeals();
  const date = req.body.date || new Date().toISOString().split('T')[0];
  if (!mealsData[date]) {
    mealsData[date] = { type: 'not-training', user: req.session.user, meals: {} };
  } else if (!mealsData[date].meals) {
    mealsData[date].meals = {};
  }
  mealsData[date].type = 'not-training';
  mealsData[date].user = req.session.user;
  for (let i = 1; i <= 5; i++) {
    mealsData[date].meals[i] = {
      protein: parseFloat(req.body['protein' + i]) || 0,
      carbs: parseFloat(req.body['carbs' + i]) || 0,
      fats: parseFloat(req.body['fats' + i]) || 0,
      proteinMealId: req.body['proteinMeal' + i],
      carbsMealId: req.body['carbsMeal' + i],
      fatsMealId: req.body['fatsMeal' + i]
    };
  }
  writeMeals(mealsData);
  res.redirect('/day-plans');
});

app.post('/check-in-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const mealsData = readMeals();
  const date = req.body.date || new Date().toISOString().split('T')[0];
  if (!mealsData[date]) {
    mealsData[date] = { type: 'check-in', user: req.session.user, meals: {} };
  } else if (!mealsData[date].meals) {
    mealsData[date].meals = {};
  }
  mealsData[date].type = 'check-in';
  mealsData[date].user = req.session.user;
  for (let i = 1; i <= 6; i++) {
    mealsData[date].meals[i] = {
      protein: parseFloat(req.body['protein' + i]) || 0,
      carbs: parseFloat(req.body['carbs' + i]) || 0,
      fats: parseFloat(req.body['fats' + i]) || 0,
      proteinMealId: req.body['proteinMeal' + i],
      carbsMealId: req.body['carbsMeal' + i],
      fatsMealId: req.body['fatsMeal' + i]
    };
  }
  writeMeals(mealsData);
  res.redirect('/day-plans');
});

app.get('/day-plans', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const mealsData = readMeals();
  const dayPlans = Object.keys(mealsData).map(date => ({
    date,
    type: mealsData[date].type,
    user: mealsData[date].user,
    meals: Object.keys(mealsData[date].meals).length
  }));
  res.render('day-plans', { dayPlans });
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
  const { date, mealNum, macro, mealId } = req.body;
  const mealsData = readMeals();
  if (!mealsData[date]) mealsData[date] = {};
  if (!mealsData[date][mealNum]) mealsData[date][mealNum] = {};
  mealsData[date][mealNum][macro + 'MealId'] = mealId;
  writeMeals(mealsData);
  res.json({ success: true });
});

app.post('/update-amount', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { date, mealNum, macro, amount } = req.body;
  const mealsData = readMeals();
  if (!mealsData[date]) mealsData[date] = {};
  if (!mealsData[date][mealNum]) mealsData[date][mealNum] = {};
  mealsData[date][mealNum][macro] = amount;
  writeMeals(mealsData);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});