import os
from pathlib import Path
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import Document, DocumentChunk, QueryHistory, SearchHistory, Conversation, ChatMessage, Quiz, Note, Flashcard
from .serializers import (
    DocumentSerializer, DocumentSummarySerializer, QuerySerializer, 
    QueryResponseSerializer, SearchSerializer, SearchResultSerializer,
    QueryHistorySerializer, SearchHistorySerializer, ConversationSerializer, ChatMessageSerializer
)
from .services.pdf_service import PDFService
from .services.web_scraper_service import WebScraperService
from .services.embedding_service import EmbeddingService
from .services.chromadb_service import ChromaDBService
from .services.ollama_service import OllamaService

import logging
logger = logging.getLogger(__name__)


# Initialize services
pdf_service = PDFService(settings.PDFS_PATH)
embedding_service = EmbeddingService()
chromadb_service = ChromaDBService(settings.CHROMADB_PATH)

# Initialize AI service (Ollama)
ai_service = OllamaService(
    api_key=settings.OLLAMA_API_KEY,
    base_url=settings.OLLAMA_BASE_URL,
    model=settings.OLLAMA_MODEL
)
logger.info(f"Using Ollama service with model: {settings.OLLAMA_MODEL}")


@api_view(['GET'])
def list_documents(request):
    clerk_user_id = getattr(request, 'clerk_user_id', None)
    
    # Filter by user if authenticated, otherwise show all
    if clerk_user_id and clerk_user_id != 'anonymous':
        documents = Document.objects.filter(clerk_user_id=clerk_user_id)  # type: ignore
        logger.info(f"Listing documents for user {clerk_user_id}")
    else:
        documents = Document.objects.all()  # type: ignore
        logger.info("Listing all documents (no user filter)")
    
    # Pagination
    paginator = PageNumberPagination()
    paginator.page_size = 20
    result_page = paginator.paginate_queryset(documents, request)
    
    serializer = DocumentSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
def get_document_summary(request, document_id):
    try:
        document = get_object_or_404(Document, id=document_id)
        
        # If summary already exists and is recent, return it
        if document.summary and document.summary_generated_at:
            return Response({
                'summary': document.summary,
                'generated_at': document.summary_generated_at
            })
        
        # Generate new summary
        if not document.summary:
            # Get document text from chunks
            chunks = DocumentChunk.objects.filter(document=document).order_by('chunk_index')  # type: ignore
            if not chunks.exists():
                return Response(
                    {'error': 'Document not processed yet'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Combine chunks for summary
            full_text = " ".join([chunk.text for chunk in chunks])
            summary = ai_service.generate_summary(full_text, document.title or document.filename, max_length=1000)
            
            # Update document
            document.summary = summary
            document.summary_generated_at = timezone.now()
            document.save()
        
        return Response({
            'summary': document.summary,
            'generated_at': document.summary_generated_at
        })
        
    except Exception as e:
        logger.error(f"Error getting document summary: {str(e)}")
        return Response(
            {'error': 'Failed to generate summary'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def query_documents(request):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', 'anonymous')
        
        serializer = QuerySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        query = serializer.validated_data['query']  # type: ignore
        document_ids = serializer.validated_data.get('document_ids', [])  # type: ignore
        
        # Only limit search to user's documents if explicitly requested via document_ids parameter
        # or if the user wants to search only their own documents (new parameter)
        search_user_documents_only = request.data.get('user_documents_only', False)
        
        if search_user_documents_only and clerk_user_id and clerk_user_id != 'anonymous':
            # Limit search to user's documents only
            user_documents = Document.objects.filter(clerk_user_id=clerk_user_id)  # type: ignore
            document_ids = [doc.id for doc in user_documents]
            logger.info(f"Limiting search to {len(document_ids)} user documents for user {clerk_user_id}")
        elif document_ids:
            # Use the provided document IDs
            logger.info(f"Searching within {len(document_ids)} specified documents")
        else:
            # Search across all documents (default behavior)
            logger.info("Searching across all documents")
            document_ids = None  # None means search all documents
        
        logger.info(f"Searching for query: {query}")
        # Search for relevant chunks with user filtering
        similar_chunks = chromadb_service.hybrid_search(
            query=query,
            n_results=10,
            top_k=100,
            epsilon=0.02,
            include_tfidf=True,
            document_ids=document_ids,
            unique_citations=False,
            clerk_user_id=clerk_user_id if search_user_documents_only and clerk_user_id != 'anonymous' else None
        )
        
        if not similar_chunks:
            return Response({
                'response': "I couldn't find relevant information to answer your question.",
                'sources': []
            })
        
        logger.info(f"Found {len(similar_chunks)} chunks, generating answer with Ollama")
        # Generate answer using AI service (Ollama or Gemini)
        result = ai_service.search_and_answer(query, similar_chunks)
        
        # Augment sources with best-effort page number (1-based) for citations
        augmented_sources = []
        for src in result.get('sources', []):
            try:
                doc_id = src['document_id']
                chunk_idx = src['chunk_index']
                document = Document.objects.get(id=doc_id)  # type: ignore
                
                # Resolve full file path similar to serve_document_file
                if document.file_path.startswith('pdfs/') or document.file_path.startswith('pdfs\\'):
                    relative_path = document.file_path.replace('\\', os.sep).replace('/', os.sep)
                    full_path = os.path.join(settings.BASE_DIR, relative_path)
                else:
                    full_path = document.file_path
                
                # Match full chunk text when possible
                matched_chunk = next((c for c in similar_chunks 
                                      if c['metadata']['document_id'] == doc_id and 
                                         c['metadata']['chunk_index'] == chunk_idx), None)
                chunk_text = matched_chunk['text'] if matched_chunk else src.get('text_preview', '')
                pages = pdf_service.find_text_pages(full_path, chunk_text)
                page = pages[0] if pages else None
                augmented_sources.append({**src, 'page': page})
            except Document.DoesNotExist:  # type: ignore
                augmented_sources.append(src)
            except Exception as e:
                logger.error(f"Error augmenting source with page: {str(e)}")
                augmented_sources.append(src)
        
        # Save query history
        QueryHistory.objects.create(  # type: ignore
            clerk_user_id=clerk_user_id,
            query=query,
            response=result['answer'],
            document_ids=[chunk['metadata']['document_id'] for chunk in similar_chunks]
        )
        
        return Response({
            'answer': result['answer'],
            'sources': augmented_sources,
            'query': query
        })
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return Response(
            {'error': 'Failed to process query'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def search_documents(request):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        
        serializer = SearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        query = serializer.validated_data['query']  # type: ignore
        limit = serializer.validated_data['limit']  # type: ignore
        
        # Filter by user's documents if authenticated
        document_ids = None
        if clerk_user_id and clerk_user_id != 'anonymous':
            user_documents = Document.objects.filter(clerk_user_id=clerk_user_id)  # type: ignore
            document_ids = [doc.id for doc in user_documents]
            logger.info(f"Searching within {len(document_ids)} user documents for user {clerk_user_id}")
        
        # Search for similar chunks with user filtering
        similar_chunks = chromadb_service.hybrid_search(
            query=query,
            n_results=limit,
            top_k=100,
            epsilon=0.02,
            include_tfidf=False,
            document_ids=document_ids,
            unique_citations=False,
            clerk_user_id=clerk_user_id if clerk_user_id and clerk_user_id != 'anonymous' else None
        )
        
        # Format results
        results = []
        for chunk in similar_chunks:
            try:
                document = Document.objects.get(id=chunk['metadata']['document_id'])  # type: ignore
                results.append({
                    'document': DocumentSerializer(document).data,
                    'score': chunk.get('semantic_score', chunk.get('score', 0)),
                    'chunk_text': chunk['text'],
                    'chunk_index': chunk['metadata']['chunk_index']
                })
            except Document.DoesNotExist:  # type: ignore
                continue
        
        # Save search history if user is authenticated
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if clerk_user_id:
            SearchHistory.objects.create(  # type: ignore
                clerk_user_id=clerk_user_id,
                search_query=query,
                results_count=len(results)
            )
            logger.info(f"Saved search history for user {clerk_user_id}: {query}")
        
        return Response({
            'query': query,
            'results': results,
            'total': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error searching documents: {str(e)}")
        return Response(
            {'error': 'Search failed'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_document_details(request, document_id):
    try:
        document = get_object_or_404(Document, id=document_id)
        serializer = DocumentSerializer(document)
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error getting document details: {str(e)}")
        return Response(
            {'error': 'Failed to get document details'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_search_history(request):
    try:
        # Get clerk_user_id from middleware or default for testing
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        logger.info(f"get_search_history called with user_id: {clerk_user_id}, has_auth_header: {bool(auth_header)}")
        
        # If no authenticated user, return empty array for now
        if not clerk_user_id:
            logger.info("No authenticated user, returning empty history")
            return Response([])
        
        logger.info(f"get_search_history called for user: {clerk_user_id}")
        
        # Get user's search history
        history = SearchHistory.objects.filter(clerk_user_id=clerk_user_id).order_by('-created_at')[:50]  # type: ignore
        logger.info(f"Found {history.count()} search history items for user {clerk_user_id}")
        
        # If no history found, let's check if there are any entries for similar user patterns
        if history.count() == 0:
            # Check for any entries that might match this user
            all_entries = SearchHistory.objects.all().order_by('-created_at')[:10]  # type: ignore
            logger.info(f"User {clerk_user_id} has no history. Recent entries from all users: {[{'user': h.clerk_user_id, 'query': h.search_query} for h in all_entries]}")
        
        serializer = SearchHistorySerializer(history, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        logger.error(f"Error getting search history: {str(e)}")
        return Response(
            {'error': 'Failed to get search history'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def debug_search_history(request):
    try:
        # Get all entries for debugging
        all_history = SearchHistory.objects.all().order_by('-created_at')[:20]  # type: ignore
        
        debug_info = {
            'total_entries': SearchHistory.objects.count(),  # type: ignore
            'user_id_from_request': getattr(request, 'clerk_user_id', None),
            'auth_header': request.META.get('HTTP_AUTHORIZATION', '')[:50] + '...' if request.META.get('HTTP_AUTHORIZATION') else None,
            'recent_entries': [
                {
                    'id': h.id,
                    'user_id': h.clerk_user_id,
                    'query': h.search_query,
                    'results_count': h.results_count,
                    'created_at': h.created_at.isoformat()
                } for h in all_history
            ]
        }
        
        return Response(debug_info)
        
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def delete_search_history_item(request, history_id):
    try:
        # Get clerk_user_id from middleware
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get and delete the history item (ensure it belongs to the user)
        history_item = get_object_or_404(SearchHistory, id=history_id, clerk_user_id=clerk_user_id)  # type: ignore
        history_item.delete()
        
        return Response({'message': 'Search history item deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting search history item: {str(e)}")
        return Response(
            {'error': 'Failed to delete search history item'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'HEAD', 'OPTIONS'])
def serve_document_file(request, document_id):
    # Handle CORS preflight requests
    if request.method == 'OPTIONS':
        response = Response()
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Range'
        response['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Accept-Ranges'
        return response
    
    try:
        logger.info(f"Serving document file for ID: {document_id}")
        document = get_object_or_404(Document, id=document_id)
        logger.info(f"Found document: {document.title} with file_path: {document.file_path}")
        
        # Resolve the full file path
        # Handle both forward and backslashes for cross-platform compatibility
        if document.file_path.startswith('pdfs/') or document.file_path.startswith('pdfs\\'):
            # Relative path from project root - normalize path separators
            relative_path = document.file_path.replace('\\', os.sep).replace('/', os.sep)
            full_path = os.path.join(settings.BASE_DIR, relative_path)
        else:
            # Absolute path or relative to current directory
            full_path = document.file_path
        
        # Check if file exists
        if not os.path.exists(full_path):
            logger.error(f"PDF file not found at path: {full_path}")
            raise Http404("PDF file not found")
        
        # Serve the file
        response = FileResponse(
            open(full_path, 'rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'inline; filename="{document.filename}"'
        response['Accept-Ranges'] = 'bytes'  # Enable range requests for PDF.js
        response['Access-Control-Allow-Origin'] = '*'  # Allow CORS for PDF files
        response['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Range'
        response['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Accept-Ranges'
        return response
        
    except Exception as e:
        logger.error(f"Error serving document file: {str(e)}")
        raise Http404("PDF file not found")


# Chat endpoints
@api_view(['POST'])
def create_chat_conversation(request):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', 'anonymous')
        title = request.data.get('title')
        conv = Conversation.objects.create(clerk_user_id=clerk_user_id, title=title)  # type: ignore
        return Response({'conversation_id': str(conv.id)})
    except Exception as e:
        logger.error(f"Error creating conversation: {str(e)}")
        return Response({'error': 'Failed to create conversation'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def list_chat_conversations(request):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response([])
        convs = Conversation.objects.filter(clerk_user_id=clerk_user_id).order_by('-updated_at')[:50]  # type: ignore
        serializer = ConversationSerializer(convs, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error listing conversations: {str(e)}")
        return Response({'error': 'Failed to list conversations'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_or_create_default_conversation(request):
    """Get or create a default conversation for the user"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Try to get the most recent conversation
        default_conv = Conversation.objects.filter(clerk_user_id=clerk_user_id).order_by('-updated_at').first()  # type: ignore
        
        # If no conversation exists, create one
        if not default_conv:
            default_conv = Conversation.objects.create(  # type: ignore
                clerk_user_id=clerk_user_id,
                title="Default Chat"
            )
            logger.info(f"Created default conversation {default_conv.id} for user {clerk_user_id}")
        else:
            logger.info(f"Using existing conversation {default_conv.id} for user {clerk_user_id}")
        
        serializer = ConversationSerializer(default_conv)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error getting/creating default conversation: {str(e)}")
        return Response({'error': 'Failed to get default conversation'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_chat_messages(request, conversation_id):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        conv = get_object_or_404(Conversation, id=conversation_id)
        if clerk_user_id and str(conv.id) != conversation_id and conv.clerk_user_id != clerk_user_id:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        msgs = ChatMessage.objects.filter(conversation=conv).order_by('created_at')  # type: ignore
        serializer = ChatMessageSerializer(msgs, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        return Response({'error': 'Failed to fetch messages'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def post_chat_message(request, conversation_id):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', 'anonymous')
        conv = get_object_or_404(Conversation, id=conversation_id)
        if conv.clerk_user_id != clerk_user_id and clerk_user_id is not None:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Store user message
        ChatMessage.objects.create(conversation=conv, role='user', content=content, citations=[], document_ids=[])  # type: ignore[attr-defined]
        
        # Retrieval using cosine similarity
        # Default to user's documents only if authenticated, unless explicitly overridden
        search_user_documents_only = request.data.get('user_documents_only', None)
        document_ids = None
        
        # If not explicitly set, default to True for authenticated users
        if search_user_documents_only is None:
            search_user_documents_only = (clerk_user_id and clerk_user_id != 'anonymous')
        
        if search_user_documents_only and clerk_user_id and clerk_user_id != 'anonymous':
            # Get document IDs for this user
            user_documents = Document.objects.filter(clerk_user_id=clerk_user_id)  # type: ignore
            document_ids = [doc.id for doc in user_documents]
            logger.info(f"Searching within {len(document_ids)} user documents for user {clerk_user_id}")
        else:
            # Search across all documents
            logger.info("Searching across all documents in chat")
        
        logger.info(f"Searching for query: {content}")
        similar_chunks = chromadb_service.hybrid_search(
            query=content, 
            n_results=10, 
            top_k=100, 
            epsilon=0.02, 
            include_tfidf=True, 
            document_ids=document_ids,  # Filter by user's documents only if requested
            unique_citations=False,
            clerk_user_id=clerk_user_id if search_user_documents_only and clerk_user_id != 'anonymous' else None
        )
        
        logger.info(f"Found {len(similar_chunks)} chunks, generating answer with Ollama")
        
        if not similar_chunks:
            fallback_answer = "I couldn't find relevant information to answer your question from the indexed PDFs."
            # Store assistant message with empty citations
            ChatMessage.objects.create(  # type: ignore[attr-defined]
                conversation=conv,
                role='assistant',
                content=fallback_answer,
                citations=[],
                document_ids=[]
            )
            if not conv.title:
                conv.title = content[:80]
                conv.save()
            return Response({'answer': fallback_answer, 'sources': []})
        
        # Generate answer using AI service (Ollama or Gemini)
        result = ai_service.search_and_answer(content, similar_chunks)
        
        # Augment sources with page numbers
        augmented_sources = []
        for src in result.get('sources', []):
            try:
                doc_id = src['document_id']
                chunk_idx = src['chunk_index']
                document = Document.objects.get(id=doc_id)  # type: ignore
                
                # Resolve full file path
                if document.file_path.startswith('pdfs/') or document.file_path.startswith('pdfs\\'):
                    relative_path = document.file_path.replace('\\', os.sep).replace('/', os.sep)
                    full_path = os.path.join(settings.BASE_DIR, relative_path)
                else:
                    full_path = document.file_path
                
                matched_chunk = next((c for c in similar_chunks 
                                      if c['metadata']['document_id'] == doc_id and 
                                         c['metadata']['chunk_index'] == chunk_idx), None)
                chunk_text = matched_chunk['text'] if matched_chunk else src.get('text_preview', '')
                pages = pdf_service.find_text_pages(full_path, chunk_text)
                page = pages[0] if pages else None
                augmented_sources.append({**src, 'page': page})
            except Exception:
                augmented_sources.append(src)
        
        # Store assistant message
        ChatMessage.objects.create(  # type: ignore[attr-defined]
            conversation=conv,
            role='assistant',
            content=result.get('answer', ''),
            citations=augmented_sources,
            document_ids=[chunk['metadata']['document_id'] for chunk in similar_chunks]
        )
        
        # Update conversation title if empty
        if not conv.title:
            conv.title = content[:80]
            conv.save()
        
        return Response({'answer': result.get('answer', ''), 'sources': augmented_sources})
    except Exception as e:
        logger.error(f"Error posting chat message: {str(e)}")
        return Response({'error': 'Failed to process message'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def delete_chat_conversation(request, conversation_id):
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        conv = get_object_or_404(Conversation, id=conversation_id, clerk_user_id=clerk_user_id)
        conv.delete()
        return Response({'message': 'Conversation deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        return Response({'error': 'Failed to delete conversation'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def upload_pdf(request):
    try:
        # Check authentication like other views
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        logger.info(f"Upload request - clerk_user_id: {clerk_user_id}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content-Type: {request.content_type}")
        logger.info(f"Has FILES: {hasattr(request, 'FILES')}")
        logger.info(f"FILES keys: {list(request.FILES.keys()) if hasattr(request, 'FILES') else 'N/A'}")
        
        if not clerk_user_id:
            logger.warning("Upload request rejected: No authentication")
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if request has FILES attribute and contains 'file'
        if not hasattr(request, 'FILES') or 'file' not in request.FILES:
            logger.error(f"Upload request failed: No file in request.FILES. Available keys: {list(request.FILES.keys()) if hasattr(request, 'FILES') else 'No FILES attribute'}")
            logger.error(f"Request content-type: {request.content_type}")
            logger.error(f"Request POST data keys: {list(request.POST.keys()) if hasattr(request, 'POST') else 'No POST attribute'}")
            return Response(
                {
                    'error': 'No file provided',
                    'details': 'The file was not found in the request. Please ensure you are sending the file with the field name "file" in multipart/form-data format.',
                    'content_type': request.content_type or 'Not set'
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['file']
        logger.info(f"File received - Name: {uploaded_file.name}, Size: {uploaded_file.size} bytes, Content-Type: {uploaded_file.content_type}")
        
        # Validate file type by extension
        if not uploaded_file.name.endswith('.pdf'):
            logger.warning(f"File type validation failed: {uploaded_file.name} does not end with .pdf")
            return Response(
                {
                    'error': 'Only PDF files are allowed',
                    'details': f'File "{uploaded_file.name}" is not a PDF file. Please upload a file with .pdf extension.',
                    'received_file': uploaded_file.name,
                    'received_type': uploaded_file.content_type
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file content type (additional check)
        if uploaded_file.content_type and uploaded_file.content_type not in ['application/pdf', 'application/x-pdf']:
            logger.warning(f"File content-type validation failed: {uploaded_file.content_type}")
            return Response(
                {
                    'error': 'Invalid file type',
                    'details': f'File content type "{uploaded_file.content_type}" is not recognized as PDF.',
                    'received_file': uploaded_file.name,
                    'received_type': uploaded_file.content_type
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file size (limit to 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if uploaded_file.size > max_size:
            logger.warning(f"File size validation failed: {uploaded_file.size} bytes exceeds {max_size} bytes limit")
            return Response(
                {
                    'error': 'File size exceeds 50MB limit',
                    'details': f'File size is {uploaded_file.size / (1024*1024):.2f} MB. Maximum allowed size is 50 MB.',
                    'file_size': uploaded_file.size,
                    'max_size': max_size
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate minimum file size (100KB) - but make it more lenient
        min_size = 10 * 1024  # 10KB minimum (more lenient than 100KB)
        if uploaded_file.size < min_size:
            logger.warning(f"File size validation failed: {uploaded_file.size} bytes is less than {min_size} bytes minimum")
            return Response(
                {
                    'error': 'File size is too small',
                    'details': f'File size is {uploaded_file.size / 1024:.2f} KB. Minimum allowed size is {min_size / 1024} KB.',
                    'file_size': uploaded_file.size,
                    'min_size': min_size
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create user-specific directory
        user_pdfs_path = os.path.join(settings.PDFS_PATH, clerk_user_id)
        os.makedirs(user_pdfs_path, exist_ok=True)
        logger.info(f"Document storage path: {user_pdfs_path}")
        
        # Save file
        file_path = os.path.join(user_pdfs_path, uploaded_file.name)
        
        # Handle duplicate filenames
        counter = 1
        original_name = uploaded_file.name
        name, ext = os.path.splitext(original_name)
        while os.path.exists(file_path):
            new_name = f"{name}_{counter}{ext}"
            file_path = os.path.join(user_pdfs_path, new_name)
            counter += 1
        
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
        
        # Process the PDF using existing ingestion logic
        pdf_service = PDFService(settings.PDFS_PATH)
        
        # Generate document ID from file hash
        document_id = pdf_service.get_file_hash(Path(file_path))
        
        # Check if document already exists for THIS USER (user-specific duplicate check)
        existing_document = Document.objects.filter(
            id=document_id,
            clerk_user_id=clerk_user_id
        ).first()  # type: ignore
        
        if existing_document:
            # Clean up uploaded file since it's a duplicate for this user
            os.remove(file_path)
            # Return existing document with duplicate flag (not an error)
            serializer = DocumentSerializer(existing_document)
            return Response({
                'message': 'This document has already been uploaded by you',
                'document': serializer.data,
                'is_duplicate': True
            }, status=status.HTTP_200_OK)
        
        # Extract text and metadata
        logger.info(f"Processing PDF file: {file_path}")
        try:
            text, doc_info = pdf_service.process_pdf(Path(file_path))
            logger.info(f"PDF processed successfully. Extracted {len(text)} characters of text")
        except Exception as e:
            logger.error(f"Error processing PDF file {file_path}: {str(e)}", exc_info=True)
            # Clean up uploaded file on processing error
            try:
                os.remove(file_path)
            except:
                pass
            return Response(
                {
                    'error': 'Failed to process PDF file',
                    'details': f'An error occurred while processing the PDF: {str(e)}. The file may be corrupted or invalid.',
                    'file_name': uploaded_file.name
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not text.strip():
            logger.warning(f"No text extracted from PDF: {file_path}")
            # Clean up uploaded file since it has no text
            try:
                os.remove(file_path)
            except:
                pass
            return Response(
                {
                    'error': 'No text could be extracted from this PDF',
                    'details': 'The PDF file appears to be empty or contains only images. Please upload a PDF with extractable text content.',
                    'file_name': uploaded_file.name
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create document record with pending status
        document = Document.objects.create(  # type: ignore
            id=document_id,
            title=doc_info['title'],
            filename=os.path.basename(file_path),
            file_path=file_path,
            clerk_user_id=clerk_user_id,
            processing_status='pending',
        )
        
        # Return success response immediately without waiting for any processing
        serializer = DocumentSerializer(document)
        response_data = {
            'message': 'PDF uploaded successfully. Processing will continue in the background.',
            'document': serializer.data,
            'is_duplicate': False
        }
        
        # Trigger async document processing (chunking, embedding, and summary)
        try:
            import threading
            
            def process_document_async():
                try:
                    logger.info(f"Starting async processing for document {document_id}")
                    
                    # Update status to processing
                    document.processing_status = 'processing'
                    document.save()
                    
                    # Initialize services
                    embedding_service = EmbeddingService()
                    chromadb_service = ChromaDBService(settings.CHROMADB_PATH)
                    # Use the same AI service configuration as the main service
                    ai_service_local = OllamaService(
                        api_key=settings.OLLAMA_API_KEY,
                        base_url=settings.OLLAMA_BASE_URL,
                        model=settings.OLLAMA_MODEL
                    )
                    
                    # Split text into chunks
                    chunks = embedding_service.split_text_into_chunks(text)
                    
                    if not chunks:
                        logger.error(f"No chunks created for document {document_id}")
                        return
                    
                    # Delete existing chunks for this document (handles re-uploads)
                    chromadb_service.delete_document_chunks(document_id)
                    DocumentChunk.objects.filter(document=document).delete()  # type: ignore
                    
                    # Save chunks to database using update_or_create to handle edge cases
                    chunk_objects = []
                    for chunk in chunks:
                        chunk_obj, created = DocumentChunk.objects.update_or_create(  # type: ignore
                            document=document,
                            chunk_index=chunk['chunk_index'],
                            defaults={
                                'text': chunk['text'],
                                'embedding_id': embedding_service.create_chunk_embedding_id(
                                    document_id, chunk['chunk_index']
                                )
                            }
                        )
                        chunk_objects.append(chunk_obj)
                    
                    # Add chunks to ChromaDB with clerk_user_id
                    chromadb_service.add_document_chunks(document_id, chunks, clerk_user_id=clerk_user_id)
                    logger.info(f"Document ingested: {len(chunks)} chunks added to ChromaDB at {settings.CHROMADB_PATH} for document {document_id} (file: {document.filename}) for user {clerk_user_id}")
                    
                    # Generate summary
                    try:
                        summary = ai_service_local.generate_summary(text, document.title or document.filename, max_length=1000)
                        if summary:
                            document.summary = summary
                            document.summary_generated_at = timezone.now()
                            document.save()
                            logger.info(f"Generated summary for document {document_id}")
                        else:
                            logger.warning(f"Failed to generate summary for document {document_id}")
                    except Exception as e:
                        logger.error(f"Error generating summary for document {document_id}: {str(e)}")
                    
                    # Update status to completed
                    document.processing_status = 'completed'
                    document.save()
                    logger.info(f"Completed async processing for document {document_id}")
                    
                except Exception as e:
                    logger.error(f"Error in async document processing for document {document_id}: {str(e)}")
                    # Update status to failed
                    try:
                        document.processing_status = 'failed'
                        document.save()
                    except:
                        pass
            
            # Start processing in background thread
            processing_thread = threading.Thread(target=process_document_async)
            processing_thread.daemon = True
            processing_thread.start()
            
            logger.info(f"Started async document processing thread for document {document_id}")
            
        except Exception as e:
            logger.error(f"Error starting async document processing for document {document_id}: {str(e)}")
            # Don't fail the upload if processing fails to start
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Unexpected error uploading PDF: {str(e)}", exc_info=True)
        return Response(
            {
                'error': 'Failed to upload PDF',
                'details': f'An unexpected error occurred: {str(e)}. Please try again or contact support if the problem persists.'
            }, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def scrape_website(request):
    """Scrape content from a website URL and ingest it as a document."""
    try:
        # Check authentication
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        logger.info(f"Scrape request - clerk_user_id: {clerk_user_id}")
        
        if not clerk_user_id:
            logger.warning("Scrape request rejected: No authentication")
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get URL from request
        url = request.data.get('url', '').strip()
        use_dynamic = request.data.get('use_dynamic', False)  # Optional flag to force dynamic scraping
        
        if not url:
            return Response(
                {'error': 'URL is required', 'details': 'Please provide a valid URL to scrape.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Initialize web scraper service
        web_scraper = WebScraperService(timeout=30)
        
        # Validate URL
        if not web_scraper.validate_url(url):
            return Response(
                {'error': 'Invalid URL', 'details': 'The provided URL is invalid or unsafe. Please provide a valid HTTP/HTTPS URL.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate document ID from URL hash
        document_id = web_scraper.get_url_hash(url)
        
        # Check if document already exists for THIS USER
        existing_document = Document.objects.filter(
            id=document_id,
            clerk_user_id=clerk_user_id,
            source_type='web'
        ).first()  # type: ignore
        
        if existing_document:
            serializer = DocumentSerializer(existing_document)
            return Response({
                'message': 'This website has already been scraped by you',
                'document': serializer.data,
                'is_duplicate': True
            }, status=status.HTTP_200_OK)
        
        # Scrape content
        logger.info(f"Scraping website: {url}")
        try:
            text, metadata = web_scraper.scrape(url, use_dynamic=use_dynamic)
            logger.info(f"Website scraped successfully. Extracted {len(text)} characters of text")
        except Exception as e:
            logger.error(f"Error scraping website {url}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to scrape website',
                    'details': f'An error occurred while scraping the website: {str(e)}. The website may be inaccessible, require authentication, or have restrictions.',
                    'url': url
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not text or not text.strip():
            logger.warning(f"No text extracted from website: {url}")
            return Response(
                {
                    'error': 'No content could be extracted from this website',
                    'details': 'The website appears to be empty or contains no extractable text content.',
                    'url': url
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get document info
        doc_info = web_scraper.get_document_info(url, metadata)
        
        # Create document record with pending status
        document = Document.objects.create(  # type: ignore
            id=document_id,
            title=doc_info['title'],
            filename=doc_info['filename'],
            file_path=doc_info['file_path'],
            source_url=url,
            source_type='web',
            metadata=metadata,
            clerk_user_id=clerk_user_id,
            processing_status='pending',
        )
        
        # Return success response immediately
        serializer = DocumentSerializer(document)
        response_data = {
            'message': 'Website scraped successfully. Processing will continue in the background.',
            'document': serializer.data,
            'is_duplicate': False
        }
        
        # Trigger async document processing (chunking, embedding, and summary)
        try:
            import threading
            
            def process_scraped_document_async():
                try:
                    logger.info(f"Starting async processing for scraped document {document_id}")
                    
                    # Update status to processing
                    document.processing_status = 'processing'
                    document.save()
                    
                    # Initialize services
                    embedding_service = EmbeddingService()
                    chromadb_service = ChromaDBService(settings.CHROMADB_PATH)
                    ai_service_local = OllamaService(
                        api_key=settings.OLLAMA_API_KEY,
                        base_url=settings.OLLAMA_BASE_URL,
                        model=settings.OLLAMA_MODEL
                    )
                    
                    # Split text into chunks
                    chunks = embedding_service.split_text_into_chunks(text)
                    
                    if not chunks:
                        logger.error(f"No chunks created for scraped document {document_id}")
                        return
                    
                    # Delete existing chunks for this document (handles re-scrapes)
                    chromadb_service.delete_document_chunks(document_id)
                    DocumentChunk.objects.filter(document=document).delete()  # type: ignore
                    
                    # Save chunks to database
                    chunk_objects = []
                    for chunk in chunks:
                        chunk_obj, created = DocumentChunk.objects.update_or_create(  # type: ignore
                            document=document,
                            chunk_index=chunk['chunk_index'],
                            defaults={
                                'text': chunk['text'],
                                'embedding_id': embedding_service.create_chunk_embedding_id(
                                    document_id, chunk['chunk_index']
                                )
                            }
                        )
                        chunk_objects.append(chunk_obj)
                    
                    # Add chunks to ChromaDB with clerk_user_id
                    chromadb_service.add_document_chunks(document_id, chunks, clerk_user_id=clerk_user_id)
                    logger.info(f"Scraped document ingested: {len(chunks)} chunks added to ChromaDB for document {document_id} (URL: {url}) for user {clerk_user_id}")
                    
                    # Generate summary
                    try:
                        summary = ai_service_local.generate_summary(text, document.title or url, max_length=1000)
                        if summary:
                            document.summary = summary
                            document.summary_generated_at = timezone.now()
                            document.save()
                            logger.info(f"Generated summary for scraped document {document_id}")
                        else:
                            logger.warning(f"Failed to generate summary for scraped document {document_id}")
                    except Exception as e:
                        logger.error(f"Error generating summary for scraped document {document_id}: {str(e)}")
                    
                    # Update status to completed
                    document.processing_status = 'completed'
                    document.save()
                    logger.info(f"Completed async processing for scraped document {document_id}")
                    
                except Exception as e:
                    logger.error(f"Error in async processing for scraped document {document_id}: {str(e)}", exc_info=True)
                    # Update status to failed
                    try:
                        document.processing_status = 'failed'
                        document.save()
                    except:
                        pass
            
            # Start processing in background thread
            processing_thread = threading.Thread(target=process_scraped_document_async)
            processing_thread.daemon = True
            processing_thread.start()
            
            logger.info(f"Started async processing thread for scraped document {document_id}")
            
        except Exception as e:
            logger.error(f"Error starting async processing for scraped document {document_id}: {str(e)}")
            # Don't fail the scrape if processing fails to start
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Unexpected error scraping website: {str(e)}", exc_info=True)
        return Response(
            {
                'error': 'Failed to scrape website',
                'details': f'An unexpected error occurred: {str(e)}. Please try again or contact support if the problem persists.'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def list_user_documents(request):
    """List documents uploaded by the current user"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        logger.info(f"List user documents request - clerk_user_id: {clerk_user_id}")
        
        if not clerk_user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        documents = Document.objects.filter(clerk_user_id=clerk_user_id)  # type: ignore
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error listing user documents: {str(e)}")
        return Response({'error': 'Failed to list documents'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def delete_document(request, document_id):
    """Delete a document and its associated files"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        logger.info(f"Delete document request - clerk_user_id: {clerk_user_id}, document_id: {document_id}")
        
        if not clerk_user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        
        document = get_object_or_404(Document, id=document_id)
        
        # Check if document belongs to user
        if document.clerk_user_id != clerk_user_id:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Delete associated chunks from database
        DocumentChunk.objects.filter(document=document).delete()
        
        # Delete chunks from ChromaDB
        try:
            chromadb_service = ChromaDBService(settings.CHROMADB_PATH)
            chromadb_service.delete_document_chunks(document_id)
        except Exception as e:
            logger.error(f"Error deleting document chunks from ChromaDB: {str(e)}")
            # Continue with deletion even if ChromaDB fails
        
        # Delete file from filesystem
        try:
            # Resolve the full file path (handle both relative and absolute paths)
            if document.file_path.startswith('pdfs/') or document.file_path.startswith('pdfs\\'):
                # Relative path from project root - normalize path separators
                relative_path = document.file_path.replace('\\', os.sep).replace('/', os.sep)
                full_path = os.path.join(settings.BASE_DIR, relative_path)
            else:
                # Absolute path or relative to current directory
                full_path = document.file_path
            
            if os.path.exists(full_path):
                os.remove(full_path)
                logger.info(f"Deleted document file: {full_path}")
            else:
                logger.warning(f"Document file not found at path: {full_path}")
        except Exception as e:
            logger.error(f"Error deleting document file: {str(e)}")
            # Continue with deletion even if file deletion fails
        
        # Delete document record
        document.delete()
        
        return Response({'message': 'Document deleted successfully'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return Response({'error': 'Failed to delete document'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_ingestion_status(request):
    """Get information about document ingestion locations and status"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', 'anonymous')
        
        # Get ChromaDB stats
        chromadb_stats = chromadb_service.get_collection_stats()
        
        # Get document counts
        total_docs = Document.objects.count()  # type: ignore
        user_docs = Document.objects.filter(clerk_user_id=clerk_user_id).count() if clerk_user_id != 'anonymous' else 0  # type: ignore
        
        # Get storage paths
        pdfs_path = settings.PDFS_PATH
        chromadb_path = settings.CHROMADB_PATH
        user_pdfs_path = os.path.join(pdfs_path, clerk_user_id) if clerk_user_id != 'anonymous' else None
        
        return Response({
            'storage_paths': {
                'pdfs_base_path': pdfs_path,
                'user_pdfs_path': user_pdfs_path,
                'chromadb_path': chromadb_path,
            },
            'ingestion_status': {
                'total_documents': total_docs,
                'user_documents': user_docs,
                'total_chunks_in_chromadb': chromadb_stats.get('total_chunks', 0),
                'chromadb_collection': chromadb_stats.get('collection_name', 'documents'),
            },
            'message': f'Documents are stored in: {pdfs_path}, ChromaDB at: {chromadb_path}'
        })
    except Exception as e:
        logger.error(f"Error getting ingestion status: {str(e)}")
        return Response(
            {'error': 'Failed to get ingestion status'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def generate_quiz(request, document_id):
    """Generate quiz questions from a document"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        document = get_object_or_404(Document, id=document_id, clerk_user_id=clerk_user_id)  # type: ignore
        
        # Check if document is processed
        if document.processing_status != 'completed':
            return Response(
                {'error': 'Document is still being processed. Please wait.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get document text from chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by('chunk_index')  # type: ignore
        if not chunks.exists():
            return Response(
                {'error': 'Document has no processed chunks'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Combine chunks for quiz generation
        document_text = " ".join([chunk.text for chunk in chunks])
        
        # Get number of questions from request (default 10)
        num_questions = request.data.get('num_questions', 10)
        
        logger.info(f"Generating quiz for document {document_id} with {num_questions} questions")
        
        # Generate quiz using AI service
        quiz_data = ai_service.generate_quiz(document_text, num_questions=int(num_questions))
        
        # Save or update quiz in database
        quiz, created = Quiz.objects.update_or_create(  # type: ignore
            document=document,
            clerk_user_id=clerk_user_id,
            defaults={'content': quiz_data}
        )
        
        return Response({
            'message': 'Quiz generated successfully',
            'quiz_id': str(quiz.id),
            'quiz': quiz_data,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error generating quiz: {str(e)}")
        return Response(
            {'error': 'Failed to generate quiz'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def generate_notes(request, document_id):
    """Generate structured notes from a document"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        document = get_object_or_404(Document, id=document_id, clerk_user_id=clerk_user_id)  # type: ignore
        
        # Check if document is processed
        if document.processing_status != 'completed':
            return Response(
                {'error': 'Document is still being processed. Please wait.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get document text from chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by('chunk_index')  # type: ignore
        if not chunks.exists():
            return Response(
                {'error': 'Document has no processed chunks'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Combine chunks for notes generation
        document_text = " ".join([chunk.text for chunk in chunks])
        
        # Get format from request (default 'outline')
        format_type = request.data.get('format', 'outline')
        
        logger.info(f"Generating notes for document {document_id} in {format_type} format")
        
        # Generate notes using AI service
        notes_data = ai_service.generate_notes(document_text, format=format_type)
        
        # Save or update notes in database
        note, created = Note.objects.update_or_create(  # type: ignore
            document=document,
            clerk_user_id=clerk_user_id,
            defaults={'content': notes_data}
        )
        
        return Response({
            'message': 'Notes generated successfully',
            'note_id': str(note.id),
            'notes': notes_data,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error generating notes: {str(e)}")
        return Response(
            {'error': 'Failed to generate notes'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def generate_flashcards(request, document_id):
    """Generate flashcards from a document"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        document = get_object_or_404(Document, id=document_id, clerk_user_id=clerk_user_id)  # type: ignore
        
        # Check if document is processed
        if document.processing_status != 'completed':
            return Response(
                {'error': 'Document is still being processed. Please wait.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get document text from chunks
        chunks = DocumentChunk.objects.filter(document=document).order_by('chunk_index')  # type: ignore
        if not chunks.exists():
            return Response(
                {'error': 'Document has no processed chunks'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Combine chunks for flashcard generation
        document_text = " ".join([chunk.text for chunk in chunks])
        
        # Get number of cards from request (default 20)
        num_cards = request.data.get('num_cards', 20)
        
        logger.info(f"Generating flashcards for document {document_id} with {num_cards} cards")
        
        # Generate flashcards using AI service
        flashcard_data = ai_service.generate_flashcards(document_text, num_cards=int(num_cards))
        
        # Save or update flashcards in database
        flashcard, created = Flashcard.objects.update_or_create(  # type: ignore
            document=document,
            clerk_user_id=clerk_user_id,
            defaults={'content': flashcard_data}
        )
        
        return Response({
            'message': 'Flashcards generated successfully',
            'flashcard_id': str(flashcard.id),
            'flashcards': flashcard_data,
            'created': created
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error generating flashcards: {str(e)}")
        return Response(
            {'error': 'Failed to generate flashcards'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_quiz(request, document_id):
    """Get quiz for a document"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        quiz = get_object_or_404(Quiz, document_id=document_id, clerk_user_id=clerk_user_id)  # type: ignore
        
        return Response({
            'quiz_id': str(quiz.id),
            'document_id': document_id,
            'content': quiz.content,
            'created_at': quiz.created_at,
            'updated_at': quiz.updated_at
        })
        
    except Exception as e:
        logger.error(f"Error getting quiz: {str(e)}")
        return Response(
            {'error': 'Quiz not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_notes(request, document_id):
    """Get notes for a document"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        note = get_object_or_404(Note, document_id=document_id, clerk_user_id=clerk_user_id)  # type: ignore
        
        return Response({
            'note_id': str(note.id),
            'document_id': document_id,
            'content': note.content,
            'created_at': note.created_at,
            'updated_at': note.updated_at
        })
        
    except Exception as e:
        logger.error(f"Error getting notes: {str(e)}")
        return Response(
            {'error': 'Notes not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def get_flashcards(request, document_id):
    """Get flashcards for a document"""
    try:
        clerk_user_id = getattr(request, 'clerk_user_id', None)
        if not clerk_user_id:
            return Response(
                {'error': 'Authentication required'}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        flashcard = get_object_or_404(Flashcard, document_id=document_id, clerk_user_id=clerk_user_id)  # type: ignore
        
        return Response({
            'flashcard_id': str(flashcard.id),
            'document_id': document_id,
            'content': flashcard.content,
            'created_at': flashcard.created_at,
            'updated_at': flashcard.updated_at
        })
        
    except Exception as e:
        logger.error(f"Error getting flashcards: {str(e)}")
        return Response(
            {'error': 'Flashcards not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
