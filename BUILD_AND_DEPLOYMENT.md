# Build and Deployment Guide

## Overview

This guide explains how the frontend and backend are built, how to set up the development environment, and how the build process works. Think of this as your roadmap for getting the project running and understanding how everything gets compiled and deployed.

## Frontend Build Process

### Technology Stack
- **Vite** - Our build tool (super fast!)
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Styling

### How Vite Works

Vite is different from traditional bundlers like Webpack. Here's the simple explanation:

**Development Mode:**
- Vite serves your code directly using native ES modules
- No bundling happens - files are served as-is
- When you change a file, only that file is recompiled
- This makes hot module replacement (HMR) instant

**Production Build:**
- Vite bundles everything for production
- Code is minified and optimized
- Assets are processed and optimized
- Output goes to `frontend/dist/`

### Build Configuration

The build is configured in `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    host: "::",      // Listen on all network interfaces
    port: 8080,      // Development server port
  },
  plugins: [
    react(),         // React plugin for JSX/TSX
    componentTagger() // Only in development (for Lovable)
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // @ = src folder
    },
  },
})
```

### Frontend Build Commands

**Development:**
```bash
cd frontend
npm run dev
```
- Starts dev server on `http://localhost:8080`
- Hot reload enabled
- Source maps for debugging

**Production Build:**
```bash
cd frontend
npm run build
```
- Creates optimized bundle in `frontend/dist/`
- Minifies JavaScript
- Optimizes CSS
- Tree-shakes unused code

**Preview Production Build:**
```bash
npm run preview
```
- Serves the production build locally
- Good for testing before deployment

### Frontend Dependencies

Dependencies are managed via `package.json`:
- **dependencies** - Runtime dependencies (React, Clerk, etc.)
- **devDependencies** - Build-time dependencies (Vite, TypeScript, etc.)

When you run `npm install`, it:
1. Reads `package.json`
2. Downloads all dependencies
3. Creates `node_modules/` folder
4. Generates `package-lock.json` (locks versions)

## Backend Build Process

### Technology Stack
- **Django** - Python web framework
- **Python 3.12** - Programming language
- **Virtual Environment** - Isolated Python environment

### How Django Works

Django doesn't need "building" like JavaScript - it's an interpreted language. But we do need to:
1. Set up the Python environment
2. Install dependencies
3. Run database migrations
4. Collect static files (for production)

### Backend Setup Process

**1. Create Virtual Environment:**
```bash
cd backend
python -m venv .venv
```
- Creates isolated Python environment
- Prevents dependency conflicts

**2. Activate Virtual Environment:**
```bash
# Windows
.venv\Scripts\activate

# Mac/Linux
source .venv/bin/activate
```

**3. Install Dependencies:**
```bash
pip install -r requirements.txt
```
- Reads `requirements.txt`
- Installs all Python packages
- Creates dependency tree

**4. Run Migrations:**
```bash
python manage.py migrate
```
- Creates database tables
- Applies schema changes
- Sets up initial data structure

**5. Create Superuser (Optional):**
```bash
python manage.py createsuperuser
```
- For Django admin panel access

### Backend Dependencies

Dependencies are in `backend/requirements.txt`:
```
Django==5.0.3
djangorestframework==3.14.0
chromadb==0.4.22
PyMuPDF==1.23.8
# ... and more
```

When you run `pip install -r requirements.txt`:
1. Pip reads the file
2. Downloads packages from PyPI
3. Installs them in the virtual environment
4. Resolves version conflicts

### Django Development Server

```bash
python manage.py runserver
```
- Starts server on `http://localhost:8000`
- Auto-reloads on code changes
- Shows errors in browser-friendly format

## Development Workflow

### Starting the Project Locally

**Terminal 1 - Backend:**
```bash
cd backend
.venv\Scripts\activate  # Windows
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Now you have:
- Backend API: `http://localhost:8000`
- Frontend UI: `http://localhost:8080`

### How They Communicate

The frontend makes API calls to the backend:

```typescript
// frontend/src/lib/constants.ts
export const API_BASE_URL = 
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
```

The frontend sends HTTP requests:
- `GET /api/docs/` - List documents
- `POST /api/docs/upload/` - Upload PDF
- `POST /api/chat/conversations/{id}/message/` - Send chat message

### Environment Variables

**Frontend (.env file in frontend/):**
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Backend (.env file in backend/):**
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
OLLAMA_API_KEY=your-ollama-key
CLERK_SECRET_KEY=your-clerk-secret
DATABASE_URL=  # Optional, for PostgreSQL
```

Vite uses `VITE_` prefix for environment variables that should be exposed to the browser.

## Production Build Process

### Frontend Production Build

**Build Command:**
```bash
cd frontend
npm run build
```

**What Happens:**
1. TypeScript compiles to JavaScript
2. React components are bundled
3. CSS is processed and minified
4. Assets are optimized
5. Code is minified and tree-shaken
6. Output written to `frontend/dist/`

**Output Structure:**
```
frontend/dist/
├── index.html          # Entry HTML
├── assets/
│   ├── index-[hash].js    # Bundled JavaScript
│   └── index-[hash].css   # Bundled CSS
└── [other assets]
```

**Deployment:**
- Upload `dist/` folder to hosting (Vercel, Netlify, etc.)
- Or serve via web server (Nginx, Apache)

### Backend Production Build

**No "build" step needed**, but we do:

**1. Collect Static Files:**
```bash
python manage.py collectstatic
```
- Gathers all static files (CSS, JS, images)
- Puts them in `staticfiles/` directory
- For serving via web server

**2. Set Environment Variables:**
```env
DEBUG=False
SECRET_KEY=production-secret-key
DATABASE_URL=postgresql://...
```

**3. Run Migrations:**
```bash
python manage.py migrate
```

**4. Start Server:**
```bash
# Using Gunicorn (production WSGI server)
gunicorn rag_backend.wsgi:application

# Or using uvicorn (for ASGI)
uvicorn rag_backend.asgi:application
```

## Deployment Considerations

### Frontend Deployment

**Vercel/Netlify:**
- Connect GitHub repo
- Set build command: `npm run build`
- Set output directory: `dist`
- Add environment variables in dashboard

**Custom Server:**
- Build: `npm run build`
- Serve `dist/` folder via Nginx/Apache
- Configure reverse proxy for API calls

### Backend Deployment

**Railway/Heroku:**
- Connect GitHub repo
- Set build command: `pip install -r requirements.txt`
- Set start command: `gunicorn rag_backend.wsgi:application`
- Add environment variables

**Custom Server:**
- Set up Python environment
- Install dependencies
- Run migrations
- Use Gunicorn + Nginx
- Set up process manager (systemd, supervisor)

### Database Considerations

**Development:**
- SQLite (file-based, no setup needed)
- Database file: `backend/db.sqlite3`

**Production:**
- PostgreSQL (recommended)
- Set `DATABASE_URL` environment variable
- Django automatically uses it via `dj-database-url`

### ChromaDB Storage

**Development:**
- Stored in `backend/chroma_db/`
- SQLite-based persistence

**Production:**
- Same location, but ensure it's backed up
- Can be on persistent volume
- No separate server needed (embedded)

### File Storage (PDFs)

**Development:**
- Stored in `backend/pdfs/{user_id}/`
- Local file system

**Production:**
- Can use same approach (persistent volume)
- Or use cloud storage (S3, etc.)
- Update `PDFS_PATH` in settings

## Build Artifacts

### Frontend
- `frontend/dist/` - Production build output
- `frontend/node_modules/` - Dependencies (don't commit)
- `frontend/.vite/` - Vite cache (don't commit)

### Backend
- `backend/__pycache__/` - Python bytecode (don't commit)
- `backend/.venv/` - Virtual environment (don't commit)
- `backend/db.sqlite3` - Development database (don't commit)
- `backend/chroma_db/` - Vector database (commit if needed)
- `backend/pdfs/` - User PDFs (don't commit)

## Troubleshooting Build Issues

### Frontend Issues

**"Module not found" errors:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Build fails:**
- Check TypeScript errors: `npm run lint`
- Check for missing dependencies
- Verify Node.js version (should be 18+)

### Backend Issues

**Import errors:**
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

**Database errors:**
```bash
# Reset database (WARNING: deletes data)
python manage.py flush
python manage.py migrate
```

**ChromaDB errors:**
- Check `CHROMADB_PATH` exists and is writable
- Delete `chroma_db/` folder and restart (recreates it)

## Summary

**Frontend:**
- Development: `npm run dev` → Fast HMR, no bundling
- Production: `npm run build` → Optimized bundle in `dist/`

**Backend:**
- Development: `python manage.py runserver` → Auto-reload
- Production: `gunicorn` → Production WSGI server

**Key Points:**
- Frontend uses Vite for fast development and optimized production builds
- Backend uses Django (no build step, just run Python)
- Both use environment variables for configuration
- Development and production have different setups

The build process is designed to be simple and fast, so you can focus on building features rather than fighting with build tools!
