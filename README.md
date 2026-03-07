# Meal Planning App

A Node.js Express application for collecting meal planning data with secure login using express-session.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with environment variables (see .env.example if provided).

3. Start the server:
   ```
   npm start
   ```

4. For development with auto-restart:
   ```
   npm run dev
   ```

## Features

- Secure login with sessions (admin password required for admin user)
- Meal planning data stored in data.json
- CRUD operations for meals
- EJS templating with Bootstrap styling for web interface
- Environment variable configuration

## Routes

- GET / - Home page with login/logout
- POST /login - Login form submission
- POST /logout - Logout
- GET /meals - Get all meals (JSON API, requires login)
- POST /meals - Add a new meal (JSON API, requires login, body: {name, date, ...})

## Development

The app runs on port 3000 by default.