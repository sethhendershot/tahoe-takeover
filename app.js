require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });
const dataPath = path.join(__dirname, 'meal-options.json');
const mealsPath = path.join(__dirname, 'meals.json');
const guidePath = path.join(__dirname, 'meal-guide.json');
const checkInsPath = path.join(__dirname, 'check-ins.json');

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

function readCheckIns() {
  try {
    const data = fs.readFileSync(checkInsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function writeCheckIns(data) {
  fs.writeFileSync(checkInsPath, JSON.stringify(data, null, 2));
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
app.get('/meal-options', (req, res) => {
  if (!req.session.user) {
    if (req.accepts('html')) {
      return res.redirect('/');
    } else {
      return res.status(401).send('Please log in first');
    }
  }
  const data = readData();
  if (req.accepts('html')) {
    res.render('meal-options', { meals: data.meals });
  } else {
    res.json(data.meals);
  }
});

app.get('/schedule-meals', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('schedule-meals');
});

app.post('/meal-options', (req, res) => {
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

app.get('/meals-list', (req, res) => {
  if (!req.session.user) {
    if (req.accepts('html')) {
      return res.redirect('/');
    } else {
      return res.status(401).send('Please log in first');
    }
  }
  const mealsData = readMeals();
  if (req.accepts('html')) {
    res.render('meal-list', { mealsData });
  } else {
    res.json(mealsData);
  }
});

app.post('/delete-meals', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const { date } = req.body;
  const mealsData = readMeals();
  if (mealsData[date]) {
    delete mealsData[date];
    writeMeals(mealsData);
  }
  res.redirect('/meals-list');
});

app.get('/training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  const mealsData = readMeals();
  let dayPlan = null;
  let existingDayType = null;
  if (mealsData[selectedDate]) {
    existingDayType = mealsData[selectedDate].type;
    if (mealsData[selectedDate].type === 'training') {
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
  }
  res.render('training-day', { meals: data.meals, dayPlan, selectedDate, guide: readGuide().training, existingDayType });
});

app.get('/not-training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const data = readData();
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  const mealsData = readMeals();
  let existingDayType = null;
  if (mealsData[selectedDate]) {
    existingDayType = mealsData[selectedDate].type;
  }
  res.render('not-training-day', { meals: data.meals, selectedDate, guide: readGuide()['non-training'], existingDayType });
});

app.get('/load-meals', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const mealsData = readMeals();
  const date = req.query.date;
  if (!mealsData[date]) return res.json({});
  res.json(mealsData[date].meals || {});
});

app.post('/training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const mealsData = readMeals();
  const { date, meal, action, protein, carbs, fats, proteinMealId, carbsMealId, fatsMealId } = req.body;
  if (!mealsData[date]) {
    mealsData[date] = { type: 'training', user: req.session.user, meals: {} };
  } else if (!mealsData[date].meals) {
    mealsData[date].meals = {};
  }
  mealsData[date].type = 'training';
  mealsData[date].user = req.session.user;
  const mealNum = parseInt(meal);
  if (action === 'unlog') {
    mealsData[date].meals[mealNum] = {
      protein: 0,
      carbs: 0,
      fats: 0,
      proteinMealId: '',
      carbsMealId: '',
      fatsMealId: ''
    };
  } else {
    mealsData[date].meals[mealNum] = {
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fats: parseFloat(fats) || 0,
      proteinMealId: proteinMealId || '',
      carbsMealId: carbsMealId || '',
      fatsMealId: fatsMealId || ''
    };
  }
  writeMeals(mealsData);
  res.json({ success: true });
});

app.post('/not-training-day', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const mealsData = readMeals();
  const { date, meal, action, protein, carbs, fats, proteinMealId, carbsMealId, fatsMealId } = req.body;
  if (!mealsData[date]) {
    mealsData[date] = { type: 'not-training', user: req.session.user, meals: {} };
  } else if (!mealsData[date].meals) {
    mealsData[date].meals = {};
  }
  mealsData[date].type = 'not-training';
  mealsData[date].user = req.session.user;
  const mealNum = parseInt(meal);
  if (action === 'unlog') {
    mealsData[date].meals[mealNum] = {
      protein: 0,
      carbs: 0,
      fats: 0,
      proteinMealId: '',
      carbsMealId: '',
      fatsMealId: ''
    };
  } else {
    mealsData[date].meals[mealNum] = {
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fats: parseFloat(fats) || 0,
      proteinMealId: proteinMealId || '',
      carbsMealId: carbsMealId || '',
      fatsMealId: fatsMealId || ''
    };
  }
  writeMeals(mealsData);
  res.json({ success: true });
});

app.post('/convert-day-type', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const mealsData = readMeals();
  const { date, newType } = req.body;
  if (!mealsData[date]) {
    return res.status(400).json({ error: 'Day not found' });
  }
  if (newType !== 'training' && newType !== 'not-training') {
    return res.status(400).json({ error: 'Invalid type' });
  }
  mealsData[date].type = newType;
  writeMeals(mealsData);
  res.json({ success: true });
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

app.get('/check-ins', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const checkInsData = readCheckIns();
  res.render('check-ins', { checkInsData, user: req.session.user });
});

app.get('/statistics', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('statistics', { user: req.session.user });
});

app.post('/add-check-in', upload.array('pictures', 10), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { date, weight, waist, hips } = req.body;

  // Process uploaded images
  const processedPictures = [];
  for (const file of req.files) {
    const inputPath = path.join(__dirname, 'public/uploads', file.filename);
    const outputPath = inputPath; // Overwrite the original file

    try {
      await sharp(inputPath)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(800, null, { // Max width 800px, maintain aspect ratio
          withoutEnlargement: true // Don't enlarge if smaller
        })
        .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality for compression
        .toFile(outputPath + '_temp'); // Save to temp file first

      // Replace original with processed
      fs.renameSync(outputPath + '_temp', outputPath);
      processedPictures.push(file.filename);
    } catch (error) {
      console.error('Error processing image:', error);
      // If processing fails, still include the original
      processedPictures.push(file.filename);
    }
  }

  const checkInsData = readCheckIns();
  checkInsData[date] = {
    weight: parseFloat(weight),
    measurements: { waist: parseFloat(waist), hips: parseFloat(hips) },
    pictures: processedPictures,
    user: req.session.user
  };
  writeCheckIns(checkInsData);
  res.redirect('/check-ins');
});

app.get('/create-check-in', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  res.render('create-check-in');
});

app.post('/delete-check-in', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { date } = req.body;
  const checkInsData = readCheckIns();
  if (checkInsData[date]) {
    // Optionally delete associated pictures from filesystem
    if (checkInsData[date].pictures) {
      checkInsData[date].pictures.forEach(pic => {
        const picPath = path.join(__dirname, 'public/uploads', pic);
        if (fs.existsSync(picPath)) {
          fs.unlinkSync(picPath);
        }
      });
    }
    delete checkInsData[date];
    writeCheckIns(checkInsData);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Check-in not found' });
  }
});

app.post('/reorder-picture', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { date, filename, direction } = req.body;
  const checkInsData = readCheckIns();

  if (!checkInsData[date] || !checkInsData[date].pictures) {
    return res.status(404).json({ error: 'Check-in or pictures not found' });
  }

  const pictures = checkInsData[date].pictures;
  const currentIndex = pictures.indexOf(filename);

  if (currentIndex === -1) {
    return res.status(404).json({ error: 'Picture not found in check-in' });
  }

  let newIndex;
  if (direction === 'left' && currentIndex > 0) {
    newIndex = currentIndex - 1;
  } else if (direction === 'right' && currentIndex < pictures.length - 1) {
    newIndex = currentIndex + 1;
  } else {
    return res.status(400).json({ error: 'Cannot move picture in that direction' });
  }

  // Swap positions
  [pictures[currentIndex], pictures[newIndex]] = [pictures[newIndex], pictures[currentIndex]];

  writeCheckIns(checkInsData);
  res.json({ success: true, newOrder: pictures });
});

app.post('/update-check-in', upload.array('pictures', 10), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { originalDate, date, weight, waist, hips } = req.body;

  const checkInsData = readCheckIns();
  if (!checkInsData[originalDate]) {
    return res.status(404).json({ error: 'Check-in not found' });
  }

  // Process new uploaded images if any
  let newPictures = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const inputPath = path.join(__dirname, 'public/uploads', file.filename);
      const outputPath = inputPath; // Overwrite the original file

      try {
        await sharp(inputPath)
          .rotate() // Auto-rotate based on EXIF orientation
          .resize(800, null, { // Max width 800px, maintain aspect ratio
            withoutEnlargement: true // Don't enlarge if smaller
          })
          .jpeg({ quality: 80 }) // Convert to JPEG with 80% quality for compression
          .toFile(outputPath + '_temp'); // Save to temp file first

        // Replace original with processed
        fs.renameSync(outputPath + '_temp', outputPath);
        newPictures.push(file.filename);
      } catch (error) {
        console.error('Error processing image:', error);
        // If processing fails, still include the original
        newPictures.push(file.filename);
      }
    }
  }

  // Update the check-in data
  const updatedCheckIn = {
    weight: parseFloat(weight),
    measurements: { waist: parseFloat(waist), hips: parseFloat(hips) },
    pictures: [...checkInsData[originalDate].pictures, ...newPictures], // Keep existing pictures and add new ones
    user: req.session.user
  };

  // If date changed, remove old entry and add new one
  if (originalDate !== date) {
    delete checkInsData[originalDate];
  }

  checkInsData[date] = updatedCheckIn;
  writeCheckIns(checkInsData);
  res.json({ success: true });
});

app.post('/delete-picture', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { date, filename } = req.body;
  const checkInsData = readCheckIns();

  if (!checkInsData[date] || !checkInsData[date].pictures) {
    return res.status(404).json({ error: 'Check-in or pictures not found' });
  }

  const pictures = checkInsData[date].pictures;
  const pictureIndex = pictures.indexOf(filename);

  if (pictureIndex === -1) {
    return res.status(404).json({ error: 'Picture not found in check-in' });
  }

  // Remove the picture from the array
  pictures.splice(pictureIndex, 1);

  // Delete the actual file from the filesystem
  const filePath = path.join(__dirname, 'public/uploads', filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Continue even if file deletion fails
    }
  }

  writeCheckIns(checkInsData);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});