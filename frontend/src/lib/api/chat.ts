// Chat API Service

import { apiClient } from './client';
import type {
  Conversation,
  ChatMessage,
  PostMessageResponse,
} from '../types/api';

export class ChatService {
  /**
   * Get or create default conversation
   */
  async getOrCreateDefaultConversation(token: string): Promise<Conversation> {
    return apiClient.get<Conversation>('/chat/conversations/default/', token);
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    title?: string,
    token?: string
  ): Promise<{ conversation_id: string }> {
    return apiClient.post<{ conversation_id: string }>(
      '/chat/conversations/',
      title ? { title } : undefined,
      token
    );
  }

  /**
   * List all conversations for the user
   */
  async listConversations(token: string): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>('/chat/conversations/list/', token);
  }

  /**
   * Get chat messages for a conversation
   */
  async getChatMessages(
    conversationId: string,
    token: string
  ): Promise<ChatMessage[]> {
    return apiClient.get<ChatMessage[]>(
      `/chat/conversations/${conversationId}/messages/`,
      token
    );
  }

  /**
   * Post a message to a conversation
   */
  async postMessage(
    conversationId: string,
    content: string,
    token: string,
    userDocumentsOnly: boolean = true
  ): Promise<PostMessageResponse> {
    return apiClient.post<PostMessageResponse>(
      `/chat/conversations/${conversationId}/message/`,
      {
        content,
        user_documents_only: userDocumentsOnly,
      },
      token
    );
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(
    conversationId: string,
    token: string
  ): Promise<void> {
    return apiClient.delete<void>(
      `/chat/conversations/${conversationId}/delete/`,
      token
    );
  }
}

export const chatService = new ChatService();

