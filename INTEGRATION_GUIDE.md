# Frontend-Backend Integration Guide

This guide explains how the frontend and backend are integrated and how to use the system.

## Overview

The frontend (React + Vite) is now fully integrated with the Django backend API. The integration includes:

- **API Service Layer**: Centralized API communication (`frontend/src/lib/api.ts`)
- **Search Functionality**: Real-time document search with results display
- **Document Management**: View, list, and manage documents
- **Error Handling**: Comprehensive error handling with toast notifications
- **Loading States**: Loading indicators for async operations

## Setup

### 1. Backend Setup

Start the Django backend server:

```bash
cd backend
python run.py
```

The backend will run on `http://localhost:8000` by default.

### 2. Frontend Setup

#### Environment Variables

Create a `.env` file in the `frontend` directory (optional):

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

If not set, it defaults to `http://localhost:8000/api`.

#### Start the Frontend

```bash
cd frontend
npm install  # or bun install
npm run dev  # or bun run dev
```

The frontend will run on `http://localhost:8080` (configured in `vite.config.ts`).

## Features

### 1. Document Listing

- Automatically loads all documents on page load
- Displays documents in a grid layout
- Shows document title, creation date, and summary (if available)
- Click "View" to see document details
- Click "Generate Summary" to create a summary for documents without one

### 2. Search Functionality

- Enter a search query in the search bar
- Results are displayed in the "Search Results" tab
- Click on any result to view the full document
- Search results show relevance scores and text snippets

### 3. Document Details

- Click "View" on any document card to see details
- View document summary in a modal dialog
- Generate summaries for documents that don't have one

## AI Service Configuration

The backend supports both **Ollama** and **Google Gemini** for AI features:

- **Ollama** (default if `OLLAMA_API_KEY` is set): Local/self-hosted AI
- **Gemini**: Google's cloud AI service

See `backend/OLLAMA_SETUP.md` for Ollama configuration details.

## API Endpoints Used

The following backend endpoints are integrated:

- `GET /api/docs/` - List all documents
- `GET /api/docs/{id}/` - Get document details
- `GET /api/docs/{id}/summary/` - Get or generate document summary
- `POST /api/search/` - Search documents
- `POST /api/docs/query/` - Query documents (ask questions)
- `POST /api/docs/upload/` - Upload a PDF (requires auth)
- `DELETE /api/docs/{id}/delete/` - Delete a document (requires auth)

## Components

### New Components

1. **SearchResults** (`frontend/src/components/SearchResults.tsx`)
   - Displays search results with relevance scores
   - Shows document snippets and metadata

2. **DocumentCard** (`frontend/src/components/DocumentCard.tsx`)
   - Individual document card component
   - Shows document info and actions

3. **DocumentList** (`frontend/src/components/DocumentList.tsx`)
   - Grid layout for multiple documents
   - Includes loading states

### Updated Components

1. **SearchBar** (`frontend/src/components/SearchBar.tsx`)
   - Now integrated with backend search API
   - Shows loading state during search
   - Handles errors gracefully

2. **Index Page** (`frontend/src/pages/Index.tsx`)
   - Integrated document listing
   - Search results display
   - Document detail modal

## CORS Configuration

The backend is configured to allow requests from:
- `http://localhost:8080` (Vite dev server)
- `http://localhost:5173` (Alternative Vite port)
- `http://localhost:3000` (React dev server)

If you need to add more origins, update `CORS_ALLOWED_ORIGINS` in `backend/rag_backend/settings.py`.

## Authentication (Future)

The API service is structured to support Clerk authentication. To add authentication:

1. Install Clerk:
   ```bash
   npm install @clerk/clerk-react
   ```

2. Wrap your app with ClerkProvider in `main.tsx`

3. Use `useAuth()` hook to get tokens:
   ```typescript
   const { getToken } = useAuth();
   const token = await getToken();
   ```

4. Pass tokens to API methods that require authentication

## Troubleshooting

### Backend not responding

- Ensure the backend is running on port 8000
- Check backend logs for errors
- Verify CORS settings in `backend/rag_backend/settings.py`

### Frontend can't connect to backend

- Check that `VITE_API_BASE_URL` is set correctly
- Verify the backend is accessible at the configured URL
- Check browser console for CORS errors

### No documents showing

- Ensure PDFs are ingested in the backend
- Check backend logs for ingestion errors
- Verify the database has documents

## Development Tips

1. **API Testing**: Use browser dev tools Network tab to inspect API calls
2. **Error Handling**: All errors are displayed via toast notifications
3. **Loading States**: Components show loading indicators during async operations
4. **Type Safety**: All API responses are typed with TypeScript interfaces

## Next Steps

Potential enhancements:

- [ ] Add document upload functionality
- [ ] Implement favorites/bookmarks
- [ ] Add document deletion
- [ ] Implement pagination for large document lists
- [ ] Add advanced search filters
- [ ] Integrate Clerk authentication
- [ ] Add chat/conversation features
- [ ] Implement document sharing

