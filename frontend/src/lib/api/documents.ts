// Document API Service

import { apiClient } from './client';
import type {
  Document,
  DocumentListResponse,
  DocumentSummaryResponse,
  SearchResponse,
  QueryResponse,
  SearchHistory,
} from '../types/api';

export class DocumentsService {
  /**
   * List all documents (user-specific if authenticated)
   */
  async listDocuments(token?: string, page?: number): Promise<DocumentListResponse> {
    const params = page ? `?page=${page}` : '';
    return apiClient.get<DocumentListResponse>(`/docs/${params}`, token);
  }

  /**
   * List user's documents (requires authentication)
   */
  async listUserDocuments(token: string): Promise<Document[]> {
    return apiClient.get<Document[]>('/docs/user/', token);
  }

  /**
   * Get document details
   */
  async getDocument(documentId: string, token?: string): Promise<Document> {
    return apiClient.get<Document>(`/docs/${documentId}/`, token);
  }

  /**
   * Get document summary
   */
  async getDocumentSummary(
    documentId: string,
    token?: string
  ): Promise<DocumentSummaryResponse> {
    return apiClient.get<DocumentSummaryResponse>(
      `/docs/${documentId}/summary/`,
      token
    );
  }

  /**
   * Scrape a website and ingest it as a document
   */
  async scrapeWebsite(
    url: string,
    token: string,
    useDynamic: boolean = false
  ): Promise<Document & { is_duplicate?: boolean }> {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL format: "${url}". Please provide a valid URL starting with http:// or https://`);
    }

    const response = await apiClient.post<{
      message: string;
      document: Document;
      is_duplicate?: boolean;
    }>(
      '/docs/scrape/',
      {
        url: url.trim(),
        use_dynamic: useDynamic,
      },
      token
    );

    return { ...response.document, is_duplicate: response.is_duplicate };
  }

  /**
   * Upload a PDF document
   */
  async uploadDocument(file: File, token: string): Promise<Document & { is_duplicate?: boolean }> {
    // Validate file before creating FormData
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error(`File "${file.name}" is not a PDF. Please select a PDF file.`);
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 50 MB limit.`);
    }

    if (file.size < 10 * 1024) {
      throw new Error(`File size (${(file.size / 1024).toFixed(2)} KB) is too small. Minimum size is 10 KB.`);
    }

    const formData = new FormData();
    formData.append('file', file);

    // Log FormData contents for debugging
    console.log('Uploading file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      formDataKeys: Array.from(formData.keys())
    });

    // Backend returns { message: string, document: Document, is_duplicate: boolean }
    const response = await apiClient.postFormData<{ 
      message: string; 
      document: Document; 
      is_duplicate?: boolean;
    }>(
      '/docs/upload/',
      formData,
      token
    );
    
    return { ...response.document, is_duplicate: response.is_duplicate };
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, token: string): Promise<void> {
    return apiClient.delete<void>(`/docs/${documentId}/delete/`, token);
  }

  /**
   * Search documents
   */
  async searchDocuments(
    query: string,
    limit?: number,
    token?: string
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({ query });
    if (limit) params.append('limit', limit.toString());

    return apiClient.get<SearchResponse>(`/search/?${params.toString()}`, token);
  }

  /**
   * Query documents (Q&A)
   */
  async queryDocuments(
    query: string,
    options: {
      documentIds?: string[];
      userDocumentsOnly?: boolean;
      token?: string;
    } = {}
  ): Promise<QueryResponse> {
    return apiClient.post<QueryResponse>(
      '/docs/query/',
      {
        query,
        document_ids: options.documentIds,
        user_documents_only: options.userDocumentsOnly ?? true,
      },
      options.token
    );
  }

  /**
   * Generate quiz from document
   */
  async generateQuiz(
    documentId: string,
    numQuestions: number = 10,
    token: string
  ): Promise<{ message: string; quiz_id: string; quiz: any; created: boolean }> {
    return apiClient.post<{ message: string; quiz_id: string; quiz: any; created: boolean }>(
      `/docs/${documentId}/generate-quiz/`,
      { num_questions: numQuestions },
      token
    );
  }

  /**
   * Get quiz for document
   */
  async getQuiz(documentId: string, token: string): Promise<any> {
    return apiClient.get<any>(`/docs/${documentId}/quiz/`, token);
  }

  /**
   * Generate notes from document
   */
  async generateNotes(
    documentId: string,
    format: 'outline' | 'summary' | 'key_points' = 'outline',
    token: string
  ): Promise<{ message: string; note_id: string; notes: any; created: boolean }> {
    return apiClient.post<{ message: string; note_id: string; notes: any; created: boolean }>(
      `/docs/${documentId}/generate-notes/`,
      { format },
      token
    );
  }

  /**
   * Get notes for document
   */
  async getNotes(documentId: string, token: string): Promise<any> {
    return apiClient.get<any>(`/docs/${documentId}/notes/`, token);
  }

  /**
   * Generate flashcards from document
   */
  async generateFlashcards(
    documentId: string,
    numCards: number = 20,
    token: string
  ): Promise<{ message: string; flashcard_id: string; flashcards: any; created: boolean }> {
    return apiClient.post<{ message: string; flashcard_id: string; flashcards: any; created: boolean }>(
      `/docs/${documentId}/generate-flashcards/`,
      { num_cards: numCards },
      token
    );
  }

  /**
   * Get flashcards for document
   */
  async getFlashcards(documentId: string, token: string): Promise<any> {
    return apiClient.get<any>(`/docs/${documentId}/flashcards/`, token);
  }

  /**
   * Get search history
   */
  async getSearchHistory(token: string): Promise<SearchHistory[]> {
    return apiClient.get<SearchHistory[]>('/history/', token);
  }

  /**
   * Delete search history item
   */
  async deleteSearchHistoryItem(historyId: number, token: string): Promise<void> {
    return apiClient.delete<void>(`/history/${historyId}/`, token);
  }
}

export const documentsService = new DocumentsService();

