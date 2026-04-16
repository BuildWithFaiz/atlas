# Data Storage Guide

## Overview

This document explains how data is stored in Atlas AI Assistant. We use three main storage systems: a relational database (PostgreSQL/SQLite), a vector database (ChromaDB), and the file system. Let me walk you through each one and how they work together.

## Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                      │
│              (Django Views & Services)                   │
└───────────────┬───────────────────┬─────────────────────┘
                │                   │
        ┌───────▼────────┐  ┌──────▼────────┐
        │  PostgreSQL/    │  │   ChromaDB    │
        │  SQLite         │  │  (Vectors)    │
        │                 │  │               │
        │ - Documents     │  │ - Embeddings  │
        │ - Chunks        │  │ - Metadata    │
        │ - Conversations │  │               │
        │ - Messages      │  │               │
        └─────────────────┘  └───────────────┘
                │
        ┌───────▼────────┐
        │  File System   │
        │                │
        │ - PDF files    │
        │   (user dirs)  │
        └────────────────┘
```

## Relational Database (PostgreSQL/SQLite)

### Why Two Databases?

- **Development**: SQLite (file-based, no setup)
- **Production**: PostgreSQL (scalable, robust)

Django automatically switches based on the `DATABASE_URL` environment variable.

### Database Models

Let's go through each model and what it stores:

#### 1. Document Model

**Purpose**: Stores metadata about uploaded PDFs

**Fields:**
```python
class Document(models.Model):
    id = CharField(primary_key=True)           # MD5 hash of file content
    title = CharField(max_length=500)           # Document title
    filename = CharField(max_length=500)        # Original filename
    file_path = CharField(max_length=1000)      # Path to PDF file
    clerk_user_id = CharField()                 # Who uploaded it
    source_type = CharField()                   # 'pdf' or 'web'
    source_url = URLField()                     # For web-scraped content
    metadata = JSONField()                      # Extra metadata (images, links, etc.)
    summary = TextField()                       # AI-generated summary
    summary_generated_at = DateTimeField()      # When summary was created
    processing_status = CharField()             # 'pending', 'processing', 'completed', 'failed'
    created_at = DateTimeField()                # Upload timestamp
    updated_at = DateTimeField()                # Last update timestamp
```

**Key Points:**
- Document ID is an MD5 hash of the file content (prevents duplicates)
- `clerk_user_id` ensures user isolation
- `processing_status` tracks async processing
- Summary is generated after chunking completes

**Example Data:**
```json
{
  "id": "a1b2c3d4e5f6...",
  "title": "Introduction to Machine Learning",
  "filename": "ml-intro.pdf",
  "file_path": "/path/to/pdfs/user_123/ml-intro.pdf",
  "clerk_user_id": "user_123",
  "processing_status": "completed",
  "summary": "This document covers the fundamentals...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### 2. DocumentChunk Model

**Purpose**: Stores text chunks extracted from documents

**Fields:**
```python
class DocumentChunk(models.Model):
    document = ForeignKey(Document)              # Parent document
    chunk_index = IntegerField()                # Order in document (0, 1, 2...)
    text = TextField()                          # The actual text content
    embedding_id = CharField(unique=True)       # Format: "{doc_id}_chunk_{index}"
    created_at = DateTimeField()                # When chunk was created
```

**Key Points:**
- Each document is split into multiple chunks (default: 1000 chars, 200 overlap)
- Chunks are stored in both database AND ChromaDB
- `embedding_id` links database chunk to ChromaDB embedding
- Unique constraint on (document, chunk_index)

**Why Chunks?**
- Documents are too large to embed as one piece
- Chunks allow precise retrieval (find exact relevant sections)
- Overlap ensures context isn't lost at boundaries

**Example Data:**
```json
{
  "id": 1,
  "document": "a1b2c3d4e5f6...",
  "chunk_index": 0,
  "text": "Machine learning is a subset of artificial intelligence...",
  "embedding_id": "a1b2c3d4e5f6_chunk_0"
}
```

#### 3. Conversation Model

**Purpose**: Groups chat messages into conversations

**Fields:**
```python
class Conversation(models.Model):
    id = UUIDField(primary_key=True)            # Unique conversation ID
    clerk_user_id = CharField()                 # Owner of conversation
    title = CharField(max_length=500)            # Auto-generated from first message
    created_at = DateTimeField()                # When conversation started
    updated_at = DateTimeField()                # Last message timestamp
```

**Key Points:**
- UUID ensures globally unique IDs
- Title is auto-generated from first user message
- Updated when new messages are added

**Example Data:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "clerk_user_id": "user_123",
  "title": "What is machine learning?",
  "created_at": "2024-01-15T11:00:00Z",
  "updated_at": "2024-01-15T11:05:00Z"
}
```

#### 4. ChatMessage Model

**Purpose**: Stores individual messages in conversations

**Fields:**
```python
class ChatMessage(models.Model):
    conversation = ForeignKey(Conversation)     # Parent conversation
    role = CharField(max_length=20)            # 'user' or 'assistant'
    content = TextField()                      # Message text
    citations = JSONField(default=list)        # Source references
    document_ids = JSONField(default=list)     # Documents used in answer
    created_at = DateTimeField()               # Message timestamp
```

**Key Points:**
- Stores both user questions and AI answers
- Citations include document_id, chunk_index, page number, scores
- `document_ids` tracks which documents were used

**Example Data:**
```json
{
  "id": 42,
  "conversation": "550e8400-e29b-41d4-a716-446655440000",
  "role": "assistant",
  "content": "Machine learning is a subset of AI that enables systems to learn...",
  "citations": [
    {
      "document_id": "a1b2c3d4e5f6...",
      "chunk_index": 0,
      "page": 1,
      "score": 0.95
    }
  ],
  "document_ids": ["a1b2c3d4e5f6..."],
  "created_at": "2024-01-15T11:00:05Z"
}
```

#### 5. Study Materials Models

**Quiz, Note, and Flashcard Models:**
```python
class Quiz(models.Model):
    id = UUIDField(primary_key=True)
    document = ForeignKey(Document)
    clerk_user_id = CharField()
    content = JSONField()  # Questions, answers, options
    created_at = DateTimeField()

class Note(models.Model):
    id = UUIDField(primary_key=True)
    document = ForeignKey(Document)
    clerk_user_id = CharField()
    content = JSONField()  # Structured notes (outline, key points)
    created_at = DateTimeField()

class Flashcard(models.Model):
    id = UUIDField(primary_key=True)
    document = ForeignKey(Document)
    clerk_user_id = CharField()
    content = JSONField()  # Flashcard pairs (front/back, Q&A)
    created_at = DateTimeField()
```

**Key Points:**
- One quiz/note/flashcard set per document per user
- Content stored as JSON for flexibility
- Generated on-demand by AI

## ChromaDB (Vector Database)

### What is ChromaDB?

ChromaDB stores document embeddings (vector representations of text). It's used for semantic search - finding documents by meaning, not just keywords.

### How It Works

1. **Text → Embedding**: Each chunk is converted to a vector (array of numbers)
2. **Store in ChromaDB**: Vector + metadata stored together
3. **Search**: Query is also embedded, then ChromaDB finds similar vectors

### Storage Structure

**Collection**: "documents" (all embeddings in one collection)

**Each Entry Contains:**
- **ID**: `"{document_id}_chunk_{index}"` (e.g., "a1b2c3_chunk_0")
- **Document**: The text chunk
- **Metadata**:
  ```json
  {
    "document_id": "a1b2c3d4e5f6...",
    "chunk_index": 0,
    "clerk_user_id": "user_123",
    "start_char": 0,
    "end_char": 1000
  }
  ```
- **Embedding**: Vector (automatically generated by ChromaDB)

### Why ChromaDB?

- **Fast Semantic Search**: Finds similar content by meaning
- **Embedded**: Runs in-process, no separate server
- **Persistent**: Data saved to disk (`chroma_db/` folder)
- **Simple API**: Easy to use from Python

### Storage Location

- **Development**: `backend/chroma_db/`
- **Production**: Same location (ensure it's on persistent volume)

### Data Flow

```
1. Document uploaded
   ↓
2. Text extracted and chunked
   ↓
3. Each chunk → Embedding (vector)
   ↓
4. Stored in ChromaDB with metadata
   ↓
5. When user searches:
   - Query → Embedding
   - ChromaDB finds similar vectors
   - Returns top matches with scores
```

## File System Storage

### PDF Storage

**Structure:**
```
backend/pdfs/
└── {clerk_user_id}/
    ├── document1.pdf
    ├── document2.pdf
    └── document3.pdf
```

**Key Points:**
- Each user has their own directory
- Prevents access to other users' files
- Filenames are sanitized (spaces → underscores, etc.)
- Duplicate filenames get `_1`, `_2` suffix

**Example:**
```
backend/pdfs/
└── user_37A16NI0fdUE8eubREy4EEAanHJ/
    ├── ml-intro.pdf
    ├── deep-learning.pdf
    └── python-basics.pdf
```

### Why File System?

- **Simple**: No database bloat
- **Direct Access**: Can serve files directly
- **User Isolation**: Directory structure enforces separation
- **Backup**: Easy to backup entire `pdfs/` folder

## Data Relationships

### How Models Connect

```
Document (1) ──→ (Many) DocumentChunk
    │
    ├──→ (Many) Quiz
    ├──→ (Many) Note
    └──→ (Many) Flashcard

Conversation (1) ──→ (Many) ChatMessage
    │
    └──→ clerk_user_id (links to user)

DocumentChunk.embedding_id ──→ ChromaDB ID (same value)
```

### Foreign Key Relationships

- **DocumentChunk.document** → Document (CASCADE delete)
- **ChatMessage.conversation** → Conversation (CASCADE delete)
- **Quiz/Note/Flashcard.document** → Document (CASCADE delete)

**CASCADE delete means**: If you delete a Document, all its chunks, quizzes, notes, and flashcards are automatically deleted.

## Data Flow: Document Upload

Let's trace what happens when a user uploads a PDF:

```
1. User uploads PDF
   ↓
2. Backend receives file
   ↓
3. Save to: pdfs/{user_id}/filename.pdf
   ↓
4. Generate document_id (MD5 hash of file)
   ↓
5. Create Document record in database:
   - id: hash
   - title: from PDF metadata
   - filename: original name
   - file_path: full path
   - clerk_user_id: user ID
   - processing_status: "pending"
   ↓
6. Background processing starts:
   ↓
7. Extract text from PDF
   ↓
8. Split text into chunks (1000 chars, 200 overlap)
   ↓
9. For each chunk:
   a. Create DocumentChunk in database
   b. Generate embedding_id
   c. Store in ChromaDB (with embedding)
   ↓
10. Generate summary using AI
   ↓
11. Update Document:
    - summary: AI-generated text
    - processing_status: "completed"
```

## Data Flow: Search/Query

When a user asks a question:

```
1. User query: "What is machine learning?"
   ↓
2. Query embedded (converted to vector)
   ↓
3. ChromaDB hybrid search:
   - Semantic search (vector similarity)
   - Keyword matching
   - TF-IDF scoring
   ↓
4. Returns top chunks with scores
   ↓
5. AI generates answer using chunks as context
   ↓
6. Find page numbers for citations (PDFService)
   ↓
7. Create ChatMessage records:
   - User message
   - Assistant message (with citations)
   ↓
8. Return answer + sources to frontend
```

## User Data Isolation

### How We Ensure Privacy

1. **Database Level**:
   - All queries filter by `clerk_user_id`
   - Users can only see their own documents

2. **File System Level**:
   - PDFs stored in user-specific directories
   - Path includes `clerk_user_id`

3. **ChromaDB Level**:
   - Metadata includes `clerk_user_id`
   - Search queries filter by user ID

**Example Query:**
```python
# Only get user's documents
documents = Document.objects.filter(clerk_user_id=request.clerk_user_id)

# Only search user's chunks
results = chromadb_service.hybrid_search(
    query=query,
    clerk_user_id=request.clerk_user_id
)
```

## Data Backup Considerations

### What to Backup

1. **Database** (PostgreSQL/SQLite):
   - All user data
   - Conversations
   - Study materials

2. **ChromaDB**:
   - `backend/chroma_db/` folder
   - Contains all embeddings

3. **PDF Files**:
   - `backend/pdfs/` folder
   - User-uploaded documents

### Backup Strategy

- **Database**: Regular SQL dumps
- **ChromaDB**: Copy `chroma_db/` folder
- **PDFs**: Copy `pdfs/` folder
- **Frequency**: Daily for production

## Summary

**Three Storage Systems:**
1. **PostgreSQL/SQLite**: Relational data (documents, chunks, conversations, messages)
2. **ChromaDB**: Vector embeddings for semantic search
3. **File System**: PDF files (user-specific directories)

**Key Principles:**
- User isolation at every level
- Chunks stored in both database and ChromaDB
- Foreign keys maintain relationships
- CASCADE deletes keep data consistent

**Data Flow:**
- Upload → Database + File System + ChromaDB
- Search → ChromaDB → Database → Response
- Chat → Database (messages) + ChromaDB (search)

Everything is designed to be secure, scalable, and maintainable!
