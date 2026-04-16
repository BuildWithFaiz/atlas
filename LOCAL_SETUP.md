# Local Setup Guide

## Quick Start

Want to run Atlas AI Assistant on your local machine? This guide will walk you through everything step by step. We'll set up both the frontend and backend, configure environment variables, and get you up and running.

## Prerequisites

Before you start, make sure you have these installed:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **Python** (version 3.12 or higher) - [Download here](https://www.python.org/downloads/)
- **Git** - [Download here](https://git-scm.com/downloads)

You can check if you have them installed:
```bash
node --version
python --version
git --version
```

## Step 1: Clone the Repository

First, get the code on your machine:

```bash
git clone <repository-url>
cd "Atlas-Ai assitant"
```

## Step 2: Backend Setup

### 2.1 Create Virtual Environment

We'll create an isolated Python environment so dependencies don't conflict:

```bash
cd backend
python -m venv .venv
```

### 2.2 Activate Virtual Environment

**Windows:**
```bash
.venv\Scripts\activate
```

**Mac/Linux:**
```bash
source .venv/bin/activate
```

You should see `(.venv)` in your terminal prompt, which means it's active.

### 2.3 Install Dependencies

Install all the Python packages we need:

```bash
pip install -r requirements.txt
```

This might take a few minutes. You'll see packages being downloaded and installed.

### 2.4 Set Up Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# In backend/ directory
# Create .env file (Windows: type nul > .env, Mac/Linux: touch .env)
```

Add these variables to `.env`:

```env
# Django Settings
SECRET_KEY=your-secret-key-here-change-this-in-production
DEBUG=True

# Database (optional - uses SQLite by default if not set)
# DATABASE_URL=postgresql://user:password@localhost/dbname

# Ollama AI Service
# Get your API key from: https://ollama.com
OLLAMA_API_KEY=your-ollama-api-key-here
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=deepseek-v3.1:671b-cloud
USE_OLLAMA=true

# Clerk Authentication
# Get your secret key from: https://clerk.com
CLERK_SECRET_KEY=your-clerk-secret-key-here

# Storage Paths (optional - defaults shown)
CHROMADB_PATH=./chroma_db
PDFS_PATH=./pdfs
```

**Important Notes:**
- Replace `your-secret-key-here-change-this-in-production` with a random string (you can generate one [here](https://djecrety.ir/))
- Get your Ollama API key from [ollama.com](https://ollama.com)
- Get your Clerk secret key from your [Clerk dashboard](https://dashboard.clerk.com)
- For local development, you can use SQLite (no DATABASE_URL needed)

### 2.5 Run Database Migrations

Set up the database tables:

```bash
python manage.py migrate
```

This creates all the necessary database tables.

### 2.6 Create Superuser (Optional)

If you want to access the Django admin panel:

```bash
python manage.py createsuperuser
```

Follow the prompts to create an admin account.

### 2.7 Start the Backend Server

Run the development server:

```bash
python manage.py runserver
```

You should see:
```
Starting development server at http://127.0.0.1:8000/
```

Great! Your backend is running. Keep this terminal open.

## Step 3: Frontend Setup

Open a **new terminal window** (keep the backend one running).

### 3.1 Navigate to Frontend Directory

```bash
cd frontend
```

### 3.2 Install Dependencies

Install all the Node.js packages:

```bash
npm install
```

This will download all the dependencies. It might take a minute or two.

### 3.3 Set Up Environment Variables

Create a `.env` file in the `frontend/` directory:

```bash
# In frontend/ directory
# Create .env file
```

Add these variables:

```env
# API Base URL (points to your local backend)
VITE_API_BASE_URL=http://localhost:8000/api

# Clerk Publishable Key
# Get this from: https://dashboard.clerk.com
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your-key-here
```

**Important Notes:**
- Get your Clerk publishable key from your [Clerk dashboard](https://dashboard.clerk.com)
- The API URL should point to where your backend is running (default: `http://localhost:8000/api`)

### 3.4 Start the Frontend Development Server

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

Perfect! Your frontend is running.

## Step 4: Access the Application

Open your browser and go to:

**Frontend:** http://localhost:8080

You should see the Atlas landing page!

## Step 5: Test the Setup

### 5.1 Test Authentication

1. Click "Sign Up" or "Get Started"
2. Create an account (Clerk handles this)
3. You should be redirected to the chat page

### 5.2 Test Document Upload

1. Go to the Documents page
2. Click "Upload Document"
3. Select a PDF file
4. Wait for processing (you'll see status updates)

### 5.3 Test Chat

1. Once a document is processed, go to Chat
2. Ask a question about your document
3. You should get an AI-generated answer with citations

## Troubleshooting

### Backend Issues

**"Module not found" errors:**
```bash
# Make sure virtual environment is activated
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

**"Port 8000 already in use":**
```bash
# Use a different port
python manage.py runserver 8001
# Then update VITE_API_BASE_URL in frontend/.env
```

**"ChromaDB connection error":**
```bash
# ChromaDB folder will be created automatically
# Make sure you have write permissions in backend/ directory
```

**"Ollama API error":**
- Check that `OLLAMA_API_KEY` is set correctly
- Verify the API key is valid at [ollama.com](https://ollama.com)
- Check your internet connection

**"Clerk JWT verification failed":**
- Verify `CLERK_SECRET_KEY` matches your Clerk dashboard
- Make sure you're using the secret key (not publishable key) in backend
- Check that the key doesn't have extra spaces

### Frontend Issues

**"Module not found" errors:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**"Port 8080 already in use":**
```bash
# Vite will automatically try the next port
# Or specify a port in vite.config.ts
```

**"API connection error":**
- Make sure backend is running on port 8000
- Check `VITE_API_BASE_URL` in frontend/.env
- Verify CORS settings in backend (should allow localhost:8080)

**"Clerk authentication not working":**
- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
- Make sure you're using the publishable key (starts with `pk_test_` or `pk_live_`)
- Check Clerk dashboard for correct key

### Database Issues

**"Database is locked" (SQLite):**
- Make sure only one Django process is running
- Close any database viewers
- Restart the server

**Migration errors:**
```bash
# Reset migrations (WARNING: deletes data)
python manage.py flush
python manage.py migrate
```

## Development Workflow

### Running Both Servers

You need **two terminal windows**:

**Terminal 1 - Backend:**
```bash
cd backend
.venv\Scripts\activate  # Windows
# or
source .venv/bin/activate  # Mac/Linux
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Making Changes

**Frontend:**
- Edit files in `frontend/src/`
- Changes hot-reload automatically
- Check browser console for errors

**Backend:**
- Edit files in `backend/`
- Server auto-reloads on save
- Check terminal for errors

### Viewing Logs

**Backend logs:**
- Check the terminal where `runserver` is running
- Django logs appear there

**Frontend logs:**
- Open browser DevTools (F12)
- Check Console tab

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Django secret key (generate random string) |
| `DEBUG` | Yes | Set to `True` for development |
| `OLLAMA_API_KEY` | Yes | Ollama API key for AI features |
| `OLLAMA_BASE_URL` | No | Defaults to `https://ollama.com` |
| `OLLAMA_MODEL` | No | Defaults to `deepseek-v3.1:671b-cloud` |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key for authentication |
| `DATABASE_URL` | No | PostgreSQL connection string (uses SQLite if not set) |
| `CHROMADB_PATH` | No | Path to ChromaDB storage (defaults to `./chroma_db`) |
| `PDFS_PATH` | No | Path to PDF storage (defaults to `./pdfs`) |

### Frontend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | Yes | Backend API URL (default: `http://localhost:8000/api`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (starts with `pk_`) |

## Next Steps

Once everything is running:

1. **Upload a test PDF** - Try uploading a document
2. **Ask questions** - Test the chat functionality
3. **Explore the code** - Check out the source files
4. **Read the docs** - See other markdown files for architecture details

## Common Commands Reference

### Backend

```bash
# Activate virtual environment
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Mac/Linux

# Run server
python manage.py runserver

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Django shell (for debugging)
python manage.py shell
```

### Frontend

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Getting API Keys

### Ollama API Key

1. Go to [ollama.com](https://ollama.com)
2. Sign up or log in
3. Go to API keys section
4. Create a new API key
5. Copy it to `OLLAMA_API_KEY` in backend/.env

### Clerk Keys

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application (or use existing)
3. Go to API Keys section
4. Copy:
   - **Publishable Key** → `VITE_CLERK_PUBLISHABLE_KEY` in frontend/.env
   - **Secret Key** → `CLERK_SECRET_KEY` in backend/.env

## Tips for Development

1. **Keep both terminals open** - Backend and frontend need to run simultaneously
2. **Check the console** - Errors usually show up there first
3. **Use browser DevTools** - Great for debugging frontend issues
4. **Read error messages** - They usually tell you what's wrong
5. **Check environment variables** - Most issues are missing or incorrect env vars

## Need Help?

If you're stuck:

1. Check the error message carefully
2. Verify all environment variables are set
3. Make sure both servers are running
4. Check that ports aren't already in use
5. Review the troubleshooting section above

## Summary

**Quick Checklist:**
- [ ] Node.js installed
- [ ] Python installed
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Backend .env configured
- [ ] Frontend .env configured
- [ ] Database migrations run
- [ ] Backend server running (port 8000)
- [ ] Frontend server running (port 8080)
- [ ] Can access http://localhost:8080

Once all these are checked, you're ready to develop! 🚀
