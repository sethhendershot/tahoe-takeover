# Meal Planning App

A Node.js Express application for collecting meal planning data with secure login using express-session.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

3. For development with auto-restart:
   ```
   npm run dev
   ```

## Features

- Secure login with sessions
- Meal planning data stored in data.json
- CRUD operations for meals

## API Endpoints

- GET / - Check login status
- POST /login - Login with username
- POST /logout - Logout
- GET /meals - Get all meals (requires login)
- POST /meals - Add a new meal (requires login, body: {name, date, ...})

## Development

The app runs on port 3000 by default.