// API Client with error handling and authentication

import { API_BASE_URL } from '../constants';
import type { ApiError as ApiErrorType } from '../types/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: ApiErrorType
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData: ApiErrorType | undefined;
        try {
          errorData = await response.json();
        } catch {
          // If response is not JSON, use status text
        }

        throw new ApiError(
          errorData?.error || errorData?.detail || response.statusText,
          response.status,
          errorData
        );
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return {} as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error occurred',
        0
      );
    }
  }

  async get<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    token?: string
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
  }

        async postFormData<T>(
          endpoint: string,
          formData: FormData,
          token?: string
        ): Promise<T> {
          const url = `${this.baseUrl}${endpoint}`;
          
          // Don't set Content-Type header - browser will set it automatically with boundary
          const config: RequestInit = {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          };

          // Log FormData contents for debugging
          console.log('Sending FormData:', {
            endpoint,
            hasToken: !!token,
            formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
              key,
              value: value instanceof File ? { name: value.name, size: value.size, type: value.type } : value
            }))
          });

          try {
            const response = await fetch(url, config);

            if (!response.ok) {
              let errorData: ApiErrorType | undefined;
              let responseText = '';
              
              try {
                responseText = await response.text();
                // Try to parse as JSON
                if (responseText) {
                  errorData = JSON.parse(responseText);
                }
              } catch {
                // If response is not JSON, use status text
                console.error('Failed to parse error response:', responseText);
              }

              const errorMessage = errorData?.error || errorData?.detail || response.statusText;
              console.error('Upload API error:', {
                status: response.status,
                statusText: response.statusText,
                errorData,
                responseText: responseText.substring(0, 200) // First 200 chars
              });

              throw new ApiError(
                errorMessage,
                response.status,
                errorData
              );
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return await response.json();
            }

            return {} as T;
          } catch (error) {
            if (error instanceof ApiError) {
              throw error;
            }

            console.error('Network error during upload:', error);
            throw new ApiError(
              error instanceof Error ? error.message : 'Network error occurred',
              0
            );
          }
        }

  async delete<T>(endpoint: string, token?: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
}

export const apiClient = new ApiClient();

