# Atlas AI Assistant - Project Overview

## What is Atlas?

Atlas is an AI-powered document assistant that transforms your PDFs into an intelligent, searchable knowledge base. Think of it as having a smart research assistant that has read all your documents and can answer questions about them instantly.

## What Can It Do?

### Core Features

1. **Upload & Process PDFs**
   - Upload PDF documents through a simple interface
   - Automatic text extraction and processing
   - Real-time status tracking (pending → processing → completed)

2. **AI-Powered Chat**
   - Ask questions about your documents in natural language
   - Get structured, educational responses with:
     - Key points and summaries
     - Detailed explanations
     - Practical examples
     - Source citations with page numbers

3. **Hybrid Search**
   - Semantic search (understands meaning, not just keywords)
   - Keyword matching
   - TF-IDF scoring for relevance
   - Search across all your documents instantly

4. **Study Materials Generation**
   - Automatically generate quizzes from your documents
   - Create interactive flashcards
   - Generate structured notes and outlines

5. **Document Management**
   - View all your uploaded documents
   - Track processing status
   - Access document summaries
   - Delete documents when needed

6. **Conversation History**
   - Save chat conversations
   - Access previous questions and answers
   - Organize by conversation threads

## Tech Stack

### Frontend
- **React 18.3** - Modern UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **React Router** - Client-side routing
- **Clerk** - Authentication (handles sign-in/sign-up)
- **TanStack Query** - Data fetching and caching
- **Lucide React** - Icon library

### Backend
- **Django 5.0.3** - Python web framework
- **Django REST Framework** - API framework
- **ChromaDB** - Vector database for embeddings
- **Ollama** - AI service (using DeepSeek model)
- **PyMuPDF (fitz)** - PDF text extraction
- **PostgreSQL** (production) / **SQLite** (development) - Relational database
- **Clerk JWT** - Authentication tokens

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Landing Page │  │  Chat Page   │  │ Documents UI  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │             │
│  ┌──────▼──────────────────▼──────────────────▼───────┐   │
│  │           API Service Layer (TypeScript)            │   │
│  │  - DocumentsService, ChatService, etc.               │   │
│  └───────────────────────┬────────────────────────────┘   │
└──────────────────────────┼─────────────────────────────────┘
                            │ HTTP/REST API
                            │ (Bearer Token Auth)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Django REST API)                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         ClerkJWTMiddleware (Authentication)          │ │
│  └───────────────────────┬──────────────────────────────┘ │
│  ┌───────────────────────▼──────────────────────────────┐ │
│  │              Views (API Endpoints)                   │ │
│  │  - Document upload, list, delete                     │ │
│  │  - Chat conversations and messages                   │ │
│  │  - Search and query                                  │ │
│  └───────────────────────┬──────────────────────────────┘ │
│  ┌───────────────────────▼──────────────────────────────┐ │
│  │              Services Layer                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │ │
│  │  │ PDFService   │  │ Embedding    │  │ ChromaDB   │ │ │
│  │  │              │  │ Service      │  │ Service    │ │ │
│  │  └──────────────┘  └──────────────┘  └───────────┘ │ │
│  │  ┌──────────────┐                                    │ │
│  │  │ OllamaService│  (AI for summaries & answers)     │ │
│  │  └──────────────┘                                    │ │
│  └───────────────────────┬──────────────────────────────┘ │
└──────────────────────────┼─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │   ChromaDB   │  │  File System  │
│  (SQLite dev)│  │  (Vectors)    │  │   (PDFs)      │
│              │  │              │  │               │
│ - Documents  │  │ - Embeddings │  │ - PDF files   │
│ - Chunks     │  │ - Metadata   │  │   (user dirs) │
│ - Messages   │  │              │  │               │
│ - Chats      │  │              │  │               │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Project Structure

```
Atlas-Ai assistant/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── pages/              # Page components
│   │   │   ├── LandingPage.tsx
│   │   │   ├── ChatPage.tsx
│   │   │   ├── DocumentsPreviewPage.tsx
│   │   │   └── StudyMaterialsPage.tsx
│   │   ├── components/         # Reusable components
│   │   │   ├── chat/           # Chat-related components
│   │   │   ├── documents/     # Document management UI
│   │   │   ├── study/          # Study materials UI
│   │   │   └── ui/             # shadcn/ui components
│   │   ├── lib/
│   │   │   ├── api/            # API service classes
│   │   │   │   ├── client.ts   # Base API client
│   │   │   │   ├── documents.ts
│   │   │   │   └── chat.ts
│   │   │   ├── constants.ts    # App constants
│   │   │   └── utils.ts        # Utility functions
│   │   ├── App.tsx             # Main app component
│   │   └── main.tsx            # Entry point
│   ├── package.json
│   ├── vite.config.ts          # Vite configuration
│   └── tailwind.config.ts      # Tailwind CSS config
│
├── backend/                     # Django backend application
│   ├── rag_backend/            # Django project settings
│   │   ├── settings.py         # Configuration
│   │   ├── urls.py             # Root URL routing
│   │   └── wsgi.py             # WSGI config
│   ├── documents/              # Main Django app
│   │   ├── models.py           # Database models
│   │   ├── views.py            # API endpoints
│   │   ├── urls.py             # URL routing
│   │   ├── serializers.py     # Data serialization
│   │   ├── middleware.py      # JWT authentication
│   │   ├── services/          # Business logic
│   │   │   ├── pdf_service.py
│   │   │   ├── embedding_service.py
│   │   │   ├── chromadb_service.py
│   │   │   └── ollama_service.py
│   │   └── management/
│   │       └── commands/      # Django management commands
│   ├── pdfs/                  # PDF storage (user-specific)
│   ├── chroma_db/             # ChromaDB data
│   ├── manage.py              # Django management script
│   └── requirements.txt       # Python dependencies
│
└── README.md
```

## Key Technologies & Why They Were Chosen

### Frontend Choices

**Vite** - Chosen for its lightning-fast development experience. It uses native ES modules, so there's no bundling during development. Hot module replacement is instant, making development a breeze.

**React + TypeScript** - React provides a component-based architecture that's easy to reason about. TypeScript catches errors at compile time and provides excellent IDE support.

**Tailwind CSS** - Utility-first CSS means you write styles directly in your components. No context switching between files, and the final bundle is optimized (unused styles are removed).

**Clerk** - Handles all the complex authentication stuff (sign-up, sign-in, password reset, etc.) so we don't have to build it ourselves. It's secure, well-maintained, and integrates seamlessly.

**TanStack Query** - Manages server state beautifully. Handles caching, refetching, and loading states automatically. Makes data fetching much simpler.

### Backend Choices

**Django** - Mature, battle-tested framework with excellent documentation. Built-in admin panel, ORM, and security features. Perfect for building APIs quickly.

**ChromaDB** - Lightweight vector database that's easy to set up and use. Perfect for storing document embeddings for semantic search. It's embedded (runs in-process), so no separate database server needed.

**Ollama** - Provides access to powerful AI models (we use DeepSeek). Supports both cloud and local instances, giving flexibility. The API is simple and straightforward.

**PyMuPDF (fitz)** - Fast and reliable PDF text extraction. Handles various PDF formats well and provides good metadata extraction.

## How It All Works Together

1. **User uploads a PDF** → Frontend sends it to backend
2. **Backend saves PDF** → Extracts text, splits into chunks
3. **Chunks get embedded** → Stored in ChromaDB as vectors
4. **User asks a question** → Backend searches ChromaDB for relevant chunks
5. **AI generates answer** → Using Ollama, based on found chunks
6. **Answer returned** → With citations and source references

The magic is in the **RAG (Retrieval-Augmented Generation)** approach:
- Instead of asking the AI to remember everything, we give it relevant context from the documents
- This makes answers more accurate and grounded in the actual document content
- The hybrid search ensures we find the most relevant information

## User Experience Flow

1. **Landing Page** → User sees what Atlas can do
2. **Sign Up/Sign In** → Clerk handles authentication
3. **Upload Documents** → Drag and drop PDFs
4. **Wait for Processing** → Status updates in real-time
5. **Start Chatting** → Ask questions about documents
6. **Get Answers** → With citations and page numbers
7. **Generate Study Materials** → Quizzes, flashcards, notes

## Security & Privacy

- **User Isolation**: Each user's documents are stored separately
- **JWT Authentication**: Secure token-based auth via Clerk
- **File Validation**: PDFs are validated before processing
- **CORS Protection**: Only allowed origins can access the API
- **User-Specific Data**: All queries and searches are scoped to the user

## What Makes This Special?

1. **Hybrid Search**: Combines semantic understanding with keyword matching for better results
2. **Real-time Processing**: Documents are processed asynchronously, so the UI stays responsive
3. **Source Citations**: Every answer includes where the information came from (document, page number)
4. **Study Materials**: Not just Q&A - generates actual study tools
5. **User-Friendly**: Clean, modern UI that's easy to use

This is a production-ready system that can scale and handle real-world usage. The architecture is designed to be maintainable, testable, and extensible.
