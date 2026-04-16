// API Response Types

export interface Document {
  id: string;
  title: string;
  filename: string;
  source_type?: 'pdf' | 'web';
  source_url?: string;
  metadata?: {
    url?: string;
    title?: string;
    description?: string;
    author?: string;
    publish_date?: string;
    images?: string[];
    links?: Array<{ url: string; text: string }>;
  };
  summary?: string;
  summary_generated_at?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Document[];
}

export interface DocumentSummaryResponse {
  summary: string;
  generated_at: string;
}

export interface SearchResult {
  document: Document;
  score: number;
  chunk_text: string;
  chunk_index: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export interface QuerySource {
  document_id: string;
  chunk_index: number;
  score: number;
  text_preview: string;
  page?: number;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
  query: string;
}

export interface Conversation {
  id: string;
  clerk_user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  conversation: string;
  role: 'user' | 'assistant';
  content: string;
  citations: QuerySource[];
  document_ids: string[];
  created_at: string;
}

export interface PostMessageResponse {
  answer: string;
  sources: QuerySource[];
}

export interface ApiError {
  error: string;
  detail?: string;
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correct_answer: string;
  explanation?: string;
}

export interface Quiz {
  quiz_id: string;
  document_id: string;
  content: {
    questions: QuizQuestion[];
  };
  created_at: string;
  updated_at: string;
}

export interface NoteSection {
  heading: string;
  content: string;
  subsections?: NoteSection[];
}

export interface Note {
  note_id: string;
  document_id: string;
  content: {
    title?: string;
    sections: NoteSection[];
    key_points: string[];
    summary: string;
  };
  created_at: string;
  updated_at: string;
}

export interface FlashcardCard {
  front: string;
  back: string;
  type: 'qa' | 'term_definition' | 'concept';
}

export interface Flashcard {
  flashcard_id: string;
  document_id: string;
  content: {
    cards: FlashcardCard[];
  };
  created_at: string;
  updated_at: string;
}

export interface QuizAnswer {
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
}

export interface QuizResults {
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  answers: QuizAnswer[];
}

export interface FlashcardMark {
  cardIndex: number;
  status: 'known' | 'review' | 'unmarked';
}

export interface SearchHistory {
  id: number;
  clerk_user_id: string;
  search_query: string;
  results_count: number;
  created_at: string;
}

