# Backend Architecture & API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Services Layer](#services-layer)
7. [Authentication Flow](#authentication-flow)
8. [Document Processing Pipeline](#document-processing-pipeline)
9. [RAG (Retrieval-Augmented Generation) Flow](#rag-flow)
10. [Frontend Integration Guide](#frontend-integration-guide)

---

## Overview

The backend is a Django REST Framework application that provides a RAG (Retrieval-Augmented Generation) system for PDF documents. It enables users to:
- Upload and process PDF documents
- Search documents using semantic and keyword search
- Ask questions and get AI-generated answers based on document content
- Manage conversations and chat history
- Track document processing status

**Key Features:**
- User-specific document storage (Clerk authentication)
- Asynchronous document processing
- Hybrid search (semantic + keyword + TF-IDF)
- ChromaDB vector database for embeddings
- Ollama AI service for summarization and Q&A
- Real-time processing status tracking

---

## Tech Stack

### Core Framework
- **Django 5.0.3** - Web framework
- **Django REST Framework 3.14.0** - API framework
- **django-cors-headers 4.3.1** - CORS handling

### Database
- **SQLite** (development) / **PostgreSQL** (production via Railway)
- **ChromaDB 0.4.22** - Vector database for embeddings

### AI/ML
- **Ollama** - AI service (using `deepseek-v3.1:671b-cloud` model)
- Supports both Ollama Cloud and local instances

### PDF Processing
- **PyMuPDF 1.23.8** - PDF text extraction
- **pdfplumber 0.10.3** - PDF processing utilities

### Authentication
- **PyJWT 2.8.0** - JWT token verification
- **Clerk** - Authentication provider (JWT tokens)

### Other
- **python-dotenv** - Environment variable management
- **requests** - HTTP client for Ollama API

---

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ HTTP/REST API
       │ (Bearer Token Auth)
       ▼
┌─────────────────────────────────────┐
│      Django REST Framework          │
│  ┌───────────────────────────────┐  │
│  │  ClerkJWTMiddleware           │  │
│  │  (JWT Verification)            │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Views (API Endpoints)         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Serializers                   │  │
│  └───────────────────────────────┘  │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│      Services Layer                 │
│  ┌───────────────────────────────┐  │
│  │  PDFService                   │  │
│  │  - Extract text               │  │
│  │  - Find page numbers          │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  EmbeddingService             │  │
│  │  - Split text into chunks     │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  ChromaDBService               │  │
│  │  - Store embeddings            │  │
│  │  - Hybrid search              │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  OllamaService                 │  │
│  │  - Generate summaries          │  │
│  │  - Answer questions            │  │
│  └───────────────────────────────┘  │
└───────────┬─────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│      Data Storage                   │
│  ┌───────────────────────────────┐  │
│  │  SQLite/PostgreSQL            │  │
│  │  - Documents                  │  │
│  │  - Chunks                     │  │
│  │  - Conversations              │  │
│  │  - Messages                   │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  ChromaDB                     │  │
│  │  - Vector embeddings          │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  File System                  │  │
│  │  - PDF files (user-specific)  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Directory Structure

```
backend/
├── rag_backend/          # Django project settings
│   ├── settings.py       # Configuration
│   ├── urls.py           # Root URL routing
│   └── wsgi.py           # WSGI config
├── documents/            # Main app
│   ├── models.py         # Data models
│   ├── views.py          # API endpoints
│   ├── urls.py           # URL routing
│   ├── serializers.py    # Data serialization
│   ├── middleware.py     # JWT authentication
│   ├── services/         # Business logic
│   │   ├── pdf_service.py
│   │   ├── embedding_service.py
│   │   ├── chromadb_service.py
│   │   └── ollama_service.py
│   └── management/       # Django commands
│       └── commands/
├── favorites/            # Favorites app
├── pdfs/                 # PDF storage (user-specific)
├── chroma_db/           # ChromaDB data
└── db.sqlite3           # SQLite database
```

---

## Data Models

### Document Model
```python
class Document(models.Model):
    id = CharField(primary_key=True)  # MD5 hash of file
    title = CharField(max_length=500)
    filename = CharField(max_length=500)
    file_path = CharField(max_length=1000)
    clerk_user_id = CharField()  # User who uploaded
    summary = TextField(blank=True, null=True)
    summary_generated_at = DateTimeField(null=True)
    processing_status = CharField(choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='pending')
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

**Key Points:**
- Document ID is MD5 hash of file content (prevents duplicates)
- User-specific storage via `clerk_user_id`
- Processing status tracks async ingestion lifecycle
- Summary generated asynchronously after chunking

### DocumentChunk Model
```python
class DocumentChunk(models.Model):
    document = ForeignKey(Document, on_delete=CASCADE)
    chunk_index = IntegerField()
    text = TextField()
    embedding_id = CharField(unique=True)  # Format: "{doc_id}_chunk_{index}"
    created_at = DateTimeField(auto_now_add=True)
```

**Key Points:**
- Each document split into multiple chunks (default: 1000 chars, 200 overlap)
- Chunks stored in both database and ChromaDB
- Unique constraint on (document, chunk_index)

### Conversation Model
```python
class Conversation(models.Model):
    id = UUIDField(primary_key=True)
    clerk_user_id = CharField()
    title = CharField(max_length=500, blank=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

**Key Points:**
- UUID-based conversation IDs
- Title auto-generated from first message
- User-specific conversations

### ChatMessage Model
```python
class ChatMessage(models.Model):
    conversation = ForeignKey(Conversation, on_delete=CASCADE)
    role = CharField(max_length=20)  # 'user' or 'assistant'
    content = TextField()
    citations = JSONField(default=list)  # Source references
    document_ids = JSONField(default=list)  # Documents used
    created_at = DateTimeField(auto_now_add=True)
```

**Key Points:**
- Stores both user and assistant messages
- Citations include document_id, chunk_index, page number, scores
- Document IDs track which documents were used in answer

### QueryHistory & SearchHistory Models
- Track user queries and searches
- Used for analytics and history features

---

## API Endpoints

### Base URL
```
http://localhost:8000/api/
```

### Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <clerk-jwt-token>
```

### Document Endpoints

#### 1. List Documents
```
GET /api/docs/
```
**Query Parameters:**
- `page` - Page number (pagination)
- `page_size` - Items per page (default: 20)

**Response:**
```json
{
  "count": 30,
  "next": "http://localhost:8000/api/docs/?page=2",
  "previous": null,
  "results": [
    {
      "id": "abc123...",
      "title": "Document Title",
      "filename": "document.pdf",
      "summary": "Document summary...",
      "summary_generated_at": "2024-01-01T12:00:00Z",
      "processing_status": "completed",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ]
}
```

**Behavior:**
- If authenticated: Returns only user's documents
- If not authenticated: Returns all documents

#### 2. List User Documents
```
GET /api/docs/user/
```
**Auth:** Required

**Response:** Array of user's documents (same format as above)

#### 3. Get Document Details
```
GET /api/docs/{document_id}/
```

#### 4. Get Document Summary
```
GET /api/docs/{document_id}/summary/
```
**Response:**
```json
{
  "summary": "Generated summary...",
  "generated_at": "2024-01-01T12:00:00Z"
}
```

#### 5. Upload PDF
```
POST /api/docs/upload/
```
**Auth:** Required

**Request:** `multipart/form-data`
- `file` - PDF file (max 10MB, min 100KB)

**Response:**
```json
{
  "message": "PDF uploaded successfully. Processing will continue in the background.",
  "document": {
    "id": "abc123...",
    "title": "Document Title",
    "filename": "document.pdf",
    "processing_status": "pending",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

**Processing Flow:**
1. File saved to `pdfs/{clerk_user_id}/filename.pdf`
2. Document record created with `pending` status
3. Background thread starts processing:
   - Extract text
   - Split into chunks
   - Generate embeddings → ChromaDB
   - Generate summary → Update document
   - Update status to `completed`

#### 6. Delete Document
```
DELETE /api/docs/{document_id}/delete/
```
**Auth:** Required

**Behavior:**
- Deletes chunks from database
- Deletes embeddings from ChromaDB
- Deletes PDF file from filesystem
- Deletes document record

#### 7. Serve Document File
```
GET /api/docs/{document_id}/file/
```
**Response:** PDF file stream

#### 8. Get Ingestion Status
```
GET /api/docs/ingestion-status/
```
**Response:**
```json
{
  "storage_paths": {
    "pdfs_base_path": "/path/to/pdfs",
    "user_pdfs_path": "/path/to/pdfs/{user_id}",
    "chromadb_path": "/path/to/chroma_db"
  },
  "ingestion_status": {
    "total_documents": 50,
    "user_documents": 10,
    "total_chunks_in_chromadb": 500,
    "chromadb_collection": "documents"
  }
}
```

### Search Endpoints

#### 1. Search Documents
```
POST /api/search/
```
**Request:**
```json
{
  "query": "search terms",
  "limit": 10
}
```

**Response:**
```json
{
  "query": "search terms",
  "results": [
    {
      "document": { /* Document object */ },
      "score": 0.95,
      "chunk_text": "Relevant text snippet...",
      "chunk_index": 0
    }
  ],
  "total": 5
}
```

**Behavior:**
- Uses hybrid search (semantic + keyword)
- Searches across all documents (not user-filtered)
- Saves to search history if authenticated

#### 2. Query Documents (Q&A)
```
POST /api/docs/query/
```
**Auth:** Optional (affects document filtering)

**Request:**
```json
{
  "query": "What is the main topic?",
  "document_ids": ["abc123"],  // Optional: limit to specific docs
  "user_documents_only": false  // Optional: search only user's docs
}
```

**Response:**
```json
{
  "answer": "The main topic is...",
  "sources": [
    {
      "document_id": "abc123",
      "chunk_index": 0,
      "score": 0.95,
      "text_preview": "Relevant snippet...",
      "page": 5  // Page number if found
    }
  ],
  "query": "What is the main topic?"
}
```

**Behavior:**
- Uses hybrid search to find relevant chunks
- Generates answer using Ollama
- Augments sources with page numbers
- Saves to query history

### Chat Endpoints

#### 1. Create Conversation
```
POST /api/chat/conversations/
```
**Auth:** Required

**Request:**
```json
{
  "title": "Optional title"
}
```

**Response:**
```json
{
  "conversation_id": "uuid-here"
}
```

#### 2. Get or Create Default Conversation
```
GET /api/chat/conversations/default/
```
**Auth:** Required

**Response:**
```json
{
  "id": "uuid-here",
  "clerk_user_id": "user_xxx",
  "title": "Default Chat",
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

**Behavior:**
- Returns most recent conversation
- Creates new one if none exists

#### 3. List Conversations
```
GET /api/chat/conversations/list/
```
**Auth:** Required

**Response:** Array of conversation objects

#### 4. Get Chat Messages
```
GET /api/chat/conversations/{conversation_id}/messages/
```
**Auth:** Required (must own conversation)

**Response:**
```json
[
  {
    "id": 1,
    "conversation": "uuid-here",
    "role": "user",
    "content": "Hello",
    "citations": [],
    "document_ids": [],
    "created_at": "2024-01-01T12:00:00Z"
  },
  {
    "id": 2,
    "conversation": "uuid-here",
    "role": "assistant",
    "content": "Hello! How can I help?",
    "citations": [ /* source objects */ ],
    "document_ids": ["abc123"],
    "created_at": "2024-01-01T12:00:01Z"
  }
]
```

#### 5. Post Chat Message
```
POST /api/chat/conversations/{conversation_id}/message/
```
**Auth:** Required

**Request:**
```json
{
  "content": "What is machine learning?",
  "user_documents_only": true  // Optional: default true for authenticated users
}
```

**Response:**
```json
{
  "answer": "Machine learning is...",
  "sources": [
    {
      "document_id": "abc123",
      "chunk_index": 0,
      "score": 0.95,
      "text_preview": "...",
      "page": 5
    }
  ]
}
```

**Behavior:**
- Stores user message
- Performs hybrid search (defaults to user's documents if authenticated)
- Generates answer using Ollama
- Stores assistant message with citations
- Updates conversation title if empty

#### 6. Delete Conversation
```
DELETE /api/chat/conversations/{conversation_id}/delete/
```
**Auth:** Required

---

## Services Layer

### PDFService
**Location:** `documents/services/pdf_service.py`

**Methods:**
- `extract_text_from_pdf(file_path)` - Extract all text from PDF
- `get_file_hash(file_path)` - Generate MD5 hash for document ID
- `get_document_info(file_path)` - Get PDF metadata (title, filename, size)
- `process_pdf(file_path)` - Extract text and metadata
- `find_text_pages(file_path, snippet)` - Find page numbers for text snippets

**Key Features:**
- Uses PyMuPDF (fitz) for text extraction
- Normalizes text for page finding
- Handles both absolute and relative paths

### EmbeddingService
**Location:** `documents/services/embedding_service.py`

**Methods:**
- `split_text_into_chunks(text)` - Split text into overlapping chunks

**Configuration:**
- `chunk_size`: 1000 characters (default)
- `chunk_overlap`: 200 characters (default)

**Algorithm:**
1. Clean and normalize text
2. Split by sentences
3. Group sentences into chunks (respecting size limit)
4. Add overlap between chunks

### ChromaDBService
**Location:** `documents/services/chromadb_service.py`

**Methods:**
- `add_document_chunks(document_id, chunks)` - Store chunks with embeddings
- `search_similar_chunks(query, n_results, document_ids)` - Semantic search
- `hybrid_search(...)` - Combined semantic + keyword + TF-IDF search
- `delete_document_chunks(document_id)` - Remove all chunks for document
- `get_collection_stats()` - Get collection statistics

**Hybrid Search Algorithm:**
1. **Semantic Search**: ChromaDB vector similarity (top_k=50)
2. **Keyword Overlap**: Token-based matching
3. **TF-IDF**: Term frequency-inverse document frequency
4. **Score Normalization**: Normalize all scores to [0, 1]
5. **Re-ranking**: Group by semantic score, sort groups by keyword score
6. **Deduplication**: One result per document (if `unique_citations=True`)

**Parameters:**
- `n_results`: Final number of results (default: 5)
- `top_k`: Initial semantic search results (default: 50)
- `epsilon`: Grouping threshold for re-ranking (default: 0.02)
- `include_tfidf`: Enable TF-IDF scoring (default: true)
- `document_ids`: Filter to specific documents (optional)
- `unique_citations`: One result per document (default: true)

### OllamaService
**Location:** `documents/services/ollama_service.py`

**Configuration:**
- **Model**: `deepseek-v3.1:671b-cloud` (default)
- **Base URL**: Auto-detects (Cloud if API key, else local)
- **API Endpoint**: `{base_url}/api/generate`

**Methods:**
- `generate_summary(text, title, max_length)` - Generate document summary
- `answer_question(question, context_chunks)` - Answer based on context
- `search_and_answer(query, context_chunks)` - Comprehensive Q&A with sources

**Prompt Engineering:**
- Summaries: Concise, key points, max length constraint
- Q&A: Context-aware, citation-focused, factual responses
- Temperature: 0.3-0.7 (lower for factual, higher for creative)

---

## Authentication Flow

### ClerkJWTMiddleware
**Location:** `documents/middleware.py`

**Flow:**
1. Extract `Authorization: Bearer <token>` header
2. Verify JWT token (RS256 or HS256)
3. Extract `sub` (user ID) from token
4. Attach `clerk_user_id` to request object
5. Continue to view

**Public Endpoints** (no auth required):
- `GET /api/docs/` - List documents
- `POST /api/search/` - Search (but tracks user if token provided)

**Protected Endpoints** (auth required):
- `POST /api/docs/upload/` - Upload PDF
- `GET /api/docs/user/` - User documents
- `DELETE /api/docs/{id}/delete/` - Delete document
- All chat endpoints
- All favorites endpoints

**Fallback Behavior:**
- If no `CLERK_SECRET_KEY`: Uses dev fallback (stable hash-based user ID)
- If token invalid: Returns 401 for protected endpoints
- If token missing: Allows public endpoints, blocks protected

---

## Document Processing Pipeline

### Upload Flow

```
1. User uploads PDF
   ↓
2. Validate file (type, size)
   ↓
3. Save to pdfs/{user_id}/filename.pdf
   ↓
4. Generate document ID (MD5 hash)
   ↓
5. Check for duplicates
   ↓
6. Create Document record (status: pending)
   ↓
7. Return response immediately
   ↓
8. Background thread starts:
   ├─ Extract text (PDFService)
   ├─ Split into chunks (EmbeddingService)
   ├─ Update status: processing
   ├─ Store chunks in database
   ├─ Generate embeddings → ChromaDB
   ├─ Generate summary (OllamaService)
   ├─ Update document with summary
   └─ Update status: completed
```

### Processing Status States

- **pending**: File uploaded, waiting to process
- **processing**: Currently being chunked/embedded
- **completed**: Ready for search/query
- **failed**: Error during processing

### Error Handling

- If processing fails: Status set to `failed`, document remains in database
- If duplicate: File deleted, error returned
- If no text: File deleted, error returned

---

## RAG Flow

### Query/Question Flow

```
1. User asks question
   ↓
2. Extract query text
   ↓
3. Determine document scope:
   ├─ user_documents_only=true → Filter to user's docs
   ├─ document_ids provided → Filter to specific docs
   └─ Otherwise → Search all documents
   ↓
4. Hybrid Search (ChromaDBService):
   ├─ Semantic search (vector similarity)
   ├─ Keyword overlap scoring
   ├─ TF-IDF scoring
   ├─ Score normalization
   ├─ Re-ranking by groups
   └─ Deduplication
   ↓
5. Get top N chunks (default: 5)
   ↓
6. Generate answer (OllamaService):
   ├─ Build context from chunks
   ├─ Create prompt with query + context
   ├─ Call Ollama API
   └─ Extract answer
   ↓
7. Augment sources:
   ├─ Find page numbers (PDFService)
   ├─ Add scores and metadata
   └─ Format citations
   ↓
8. Store in database:
   ├─ User message
   ├─ Assistant message with citations
   └─ Update conversation
   ↓
9. Return answer + sources
```

### Search Flow (Simpler)

```
1. User searches
   ↓
2. Hybrid search (same as above)
   ↓
3. Format results with document info
   ↓
4. Save to search history
   ↓
5. Return results
```

---

## Frontend Integration Guide

### API Service Structure

```typescript
// lib/api.ts
const API_BASE_URL = 'http://localhost:8000/api';

class ApiService {
  private getHeaders(token?: string) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // Document methods
  async getDocuments(token?: string) { }
  async getUserDocuments(token: string) { }
  async uploadDocument(file: File, token: string) { }
  async deleteDocument(documentId: string, token: string) { }
  async getDocumentSummary(documentId: string) { }

  // Search methods
  async searchDocuments(query: string, limit?: number) { }
  async queryDocuments(query: string, options: {
    documentIds?: string[];
    userDocumentsOnly?: boolean;
    token?: string;
  }) { }

  // Chat methods
  async getOrCreateDefaultConversation(token: string) { }
  async listConversations(token: string) { }
  async getChatMessages(conversationId: string, token: string) { }
  async postChatMessage(
    conversationId: string,
    content: string,
    token: string,
    userDocumentsOnly?: boolean
  ) { }
  async deleteConversation(conversationId: string, token: string) { }
}
```

### Key Frontend Patterns

#### 1. Document Upload with Status Tracking

```typescript
// Upload document
const document = await apiService.uploadDocument(file, token);

// Poll for status updates
const pollStatus = async () => {
  const updated = await apiService.getDocument(document.id);
  if (updated.processing_status === 'completed') {
    // Ready to use
  } else if (updated.processing_status === 'failed') {
    // Show error
  } else {
    // Continue polling
    setTimeout(pollStatus, 2000);
  }
};
```

#### 2. Chat Interface

```typescript
// Initialize default conversation
const conv = await apiService.getOrCreateDefaultConversation(token);
setConversationId(conv.id);

// Load messages
const messages = await apiService.getChatMessages(conv.id, token);

// Send message
const response = await apiService.postChatMessage(
  conv.id,
  userMessage,
  token,
  true  // userDocumentsOnly
);

// Display answer with citations
messages.push({
  role: 'user',
  content: userMessage
});
messages.push({
  role: 'assistant',
  content: response.answer,
  citations: response.sources
});
```

#### 3. Search Interface

```typescript
// Simple search
const results = await apiService.searchDocuments(query, 10);

// Q&A search
const answer = await apiService.queryDocuments(query, {
  userDocumentsOnly: true,
  token: token
});
```

### Error Handling

```typescript
try {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 401) {
      // Re-authenticate
    } else if (response.status === 403) {
      // Permission denied
    } else {
      // Show error message
      throw new Error(data.error || 'Request failed');
    }
  }
  
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Handle in UI
}
```

### State Management Recommendations

1. **Document List**: Use React Query or SWR for caching
2. **Chat Messages**: Local state with optimistic updates
3. **Processing Status**: Polling or WebSocket (if implemented)
4. **Conversations**: Cache with invalidation on new messages

---

## Environment Variables

Required in `.env`:

```bash
# Django
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=  # Optional: for PostgreSQL

# Ollama
OLLAMA_API_KEY=your-api-key  # Required for Ollama Cloud
OLLAMA_BASE_URL=https://ollama.com  # Optional: auto-detected
OLLAMA_MODEL=deepseek-v3.1:671b-cloud
USE_OLLAMA=true

# Clerk
CLERK_SECRET_KEY=your-clerk-secret-key

# Paths (optional)
CHROMADB_PATH=./chroma_db
PDFS_PATH=./pdfs
```

---

## Performance Considerations

1. **Async Processing**: Document ingestion happens in background
2. **Chunking**: Documents split for efficient search
3. **Hybrid Search**: Combines multiple signals for better results
4. **Caching**: Consider caching summaries and frequent queries
5. **Pagination**: Document lists are paginated (20 per page)

---

## Security Considerations

1. **JWT Verification**: All protected endpoints verify Clerk tokens
2. **User Isolation**: Documents filtered by `clerk_user_id`
3. **File Validation**: PDF type and size checks
4. **Path Traversal**: File paths validated
5. **CORS**: Configured for specific origins

---

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Error**
   - Check `CHROMADB_PATH` exists and is writable
   - Ensure ChromaDB is initialized

2. **Ollama API Error**
   - Verify `OLLAMA_API_KEY` is valid
   - Check model name is correct
   - Ensure network connectivity

3. **JWT Verification Failed**
   - Check `CLERK_SECRET_KEY` matches Clerk dashboard
   - Verify token format in frontend

4. **Document Processing Stuck**
   - Check logs in `logs/django.log`
   - Verify PDF is not corrupted
   - Check ChromaDB is accessible

---

## Next Steps for Frontend

1. **Create API Service**: Implement all endpoints
2. **Build Upload UI**: Drag-and-drop with status tracking
3. **Build Chat Interface**: Messages, citations, streaming (optional)
4. **Build Search UI**: Results display, filters
5. **Build Document Dashboard**: List, view, delete
6. **Implement Authentication**: Clerk integration
7. **Add Error Handling**: User-friendly error messages
8. **Add Loading States**: Spinners, skeletons
9. **Add Optimistic Updates**: Better UX for chat
10. **Add Real-time Updates**: WebSocket or polling for status

---

This document provides a comprehensive overview of the backend architecture. Use it as a reference when building the frontend integration.

