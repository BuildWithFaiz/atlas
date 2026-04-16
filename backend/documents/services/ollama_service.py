import os
import requests
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class OllamaService:
    """
    Service for interacting with Ollama API for text generation and Q&A.
    """
    
    def __init__(self, api_key: str = None, base_url: str = None, model: str = "deepseek-v3.1:671b-cloud"):
        """
        Initialize Ollama service.
        
        Args:
            api_key: API key (required for Ollama Cloud, optional for local instances)
            base_url: Base URL for Ollama API
                     - If api_key is provided and base_url is None, defaults to Ollama Cloud: https://ollama.com
                     - Otherwise defaults to local: http://localhost:11434
            model: Model name to use (default: llama3.2)
        """
        self.api_key = api_key
        
        # Auto-detect base URL: use cloud if API key provided, otherwise local
        if base_url:
            self.base_url = base_url.rstrip('/')
        elif api_key:
            # Use Ollama Cloud when API key is provided
            self.base_url = "https://ollama.com"
        else:
            # Default to local instance
            self.base_url = "http://localhost:11434"
        
        self.model = model
        self.api_endpoint = f"{self.base_url}/api/generate"
        self.chat_endpoint = f"{self.base_url}/api/chat"
    
    def _make_request(self, endpoint: str, payload: Dict) -> Dict:
        """Make a request to Ollama API."""
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            # API key is required for Ollama Cloud, optional for local
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'
            
            response = requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=120  # Ollama can take time for large prompts
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API request failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            raise
    
    def generate_summary(self, text: str, title: str = "", max_length: int = 1000) -> str:
        """
        Generate a summary of the provided text.
        
        Args:
            text: Text to summarize
            title: Optional document title
            max_length: Maximum length of summary
            
        Returns:
            Generated summary
        """
        try:
            title_context = f"Document: {title}\n\n" if title else ""
            prompt = f"""Please provide a concise summary of the following text. 
The summary should be no more than {max_length} characters and capture the main points.
Focus on the key topics, findings, and conclusions in the document.

{title_context}Text:
{text[:8000]}

Summary:"""
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "max_tokens": max_length // 4,  # Rough estimate
                }
            }
            
            response = self._make_request(self.api_endpoint, payload)
            summary = response.get('response', '').strip()
            
            # Truncate if too long
            if len(summary) > max_length:
                summary = summary[:max_length] + "..."
            
            logger.info(f"Generated summary of {len(summary)} characters")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return "Unable to generate summary at this time."
    
    def answer_question(self, question: str, context_chunks: List[Dict]) -> str:
        """
        Answer a question based on provided context chunks.
        
        Args:
            question: The question to answer
            context_chunks: List of context chunks with text and metadata
            
        Returns:
            Answer to the question
        """
        try:
            # Prepare context from chunks
            context_text = "\n\n".join([
                f"Document {chunk['metadata']['document_id']} (Chunk {chunk['metadata']['chunk_index']}):\n{chunk['text']}"
                for chunk in context_chunks
            ])
            
            prompt = f"""You are a helpful assistant that explains information clearly and simply. Your goal is to help users understand complex topics by breaking them down into easy-to-understand parts.

Answer the question based ONLY on the provided document context below.
If the answer cannot be found in the provided context, say "I cannot find relevant information in the provided documents."

Format your response using markdown with this structure:

## Summary
Start with a brief 2-3 sentence overview that directly answers the question. Write in simple, clear language as if explaining to someone who is learning about this topic for the first time.

## Key Information
Present the most important information in a format that makes sense for the type of question:
- For comparisons: Use a markdown table with clear column headers
- For definitions or concepts: Use a simple list or key-value format
- For step-by-step processes: Use numbered steps (1, 2, 3...)
- For general information: Use bullet points with clear explanations
- For data or statistics: Use tables or structured lists

## Detailed Explanation
Provide a clear, easy-to-follow explanation that:
- Uses simple, everyday language instead of jargon
- Breaks complex ideas into smaller, understandable pieces
- Uses subsections (###) to organize related information
- Explains each concept before moving to the next
- Builds understanding step by step

## Examples
Include real-world examples or practical applications when helpful. Explain each example clearly and why it matters. If examples don't apply, you can skip this section.

## Additional Information
Include:
- Related topics or concepts that connect to the main answer
- Important things to keep in mind or watch out for
- How this information relates to other topics

Context:
{context_text[:12000]}

Question: {question}

Writing Guidelines:
- Use simple, clear language that anyone can understand
- Avoid technical jargon unless necessary, and always explain it when used
- Organize information in a logical order
- Use tables when comparing things or showing structured data
- Use bullet points and numbered lists to make information easy to scan
- Break up long paragraphs into shorter ones
- Use bold text to highlight important terms or concepts
- Write as if you're a patient teacher explaining to a student
- Make sure each section builds on the previous one
- Keep sentences short and clear
- Use ONLY information from the provided context

Answer:"""
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,  # Balanced for natural language with factual accuracy
                }
            }
            
            response = self._make_request(self.api_endpoint, payload)
            answer = response.get('response', '').strip()
            
            logger.info(f"Generated answer for question: {question[:50]}...")
            return answer
            
        except Exception as e:
            logger.error(f"Error generating answer: {str(e)}")
            return "I'm sorry, I encountered an error while processing your question. Please try again."
    
    def search_and_answer(self, query: str, context_chunks: List[Dict]) -> Dict:
        """
        Search and provide a comprehensive answer based on search results.
        
        Args:
            query: Search query
            context_chunks: List of context chunks from search results
            
        Returns:
            Dictionary with answer, sources, and query
        """
        try:
            # Prepare context
            context_text = "\n\n".join([
                f"Source {i+1} (Document ID: {chunk['metadata']['document_id']}, Chunk: {chunk['metadata']['chunk_index']}):\n{chunk['text']}"
                for i, chunk in enumerate(context_chunks)
            ])
            
            prompt = f"""You are a helpful assistant that explains information clearly and simply. Your goal is to help users understand complex topics by breaking them down into easy-to-understand parts.

Based on the following search results, provide a clear and comprehensive answer to the user's query.

Format your response using markdown with this structure:

## Summary
Start with a brief 2-3 sentence overview that directly answers the query. Write in simple, clear language as if explaining to someone who is learning about this topic for the first time.

## Key Information
Present the most important information in a format that makes sense for the type of query:
- For comparisons: Use a markdown table with clear column headers
- For definitions or concepts: Use a simple list or key-value format
- For step-by-step processes: Use numbered steps (1, 2, 3...)
- For general information: Use bullet points with clear explanations

## Detailed Explanation
Provide a clear, easy-to-follow explanation that:
- Uses simple, everyday language instead of jargon
- Breaks complex ideas into smaller, understandable pieces
- Uses subsections (###) to organize related information
- Explains each concept before moving to the next
- Builds understanding step by step

## Examples
Include real-world examples or practical applications when helpful. Explain each example clearly and why it matters. If examples don't apply, you can skip this section.

## Additional Information
Include:
- Related topics or concepts that connect to the main answer
- Important things to keep in mind or watch out for
- How this information relates to other topics

---
**Sources:** Reference which sources (Source 1, Source 2, etc.) were used for this information.

Sources:
{context_text[:12000]}

Query: {query}

Writing Guidelines:
- Use simple, clear language that anyone can understand
- Avoid technical jargon unless necessary, and always explain it when used
- Organize information in a logical order
- Use tables when comparing things or showing structured data
- Use bullet points and numbered lists to make information easy to scan
- Break up long paragraphs into shorter ones
- Use bold text to highlight important terms or concepts
- Write as if you're a patient teacher explaining to a student
- Make sure each section builds on the previous one
- Keep sentences short and clear

Response:"""
            
            logger.info("Generating answer with Ollama")
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.5,  # Slightly higher for more natural, conversational language
                }
            }
            
            response = self._make_request(self.api_endpoint, payload)
            answer = response.get('response', '').strip()
            
            # Extract sources
            sources = []
            for i, chunk in enumerate(context_chunks):
                sources.append({
                    'document_id': chunk['metadata']['document_id'],
                    'chunk_index': chunk['metadata']['chunk_index'],
                    'score': chunk.get('score', 0),
                    'text_preview': chunk['text'][:200] + "..." if len(chunk['text']) > 200 else chunk['text'],
                    'semantic_score': chunk.get('semantic_score'),
                    'keyword_score': chunk.get('keyword_score'),
                    'tfidf_score': chunk.get('tfidf_score')
                })
            
            return {
                'answer': answer,
                'sources': sources,
                'query': query
            }
            
        except Exception as e:
            logger.error(f"Error in search and answer: {str(e)}")
            return {
                'answer': "I'm sorry, I encountered an error while processing your query. Please try again.",
                'sources': [],
                'query': query
            }
    
    def generate_quiz(self, document_text: str, num_questions: int = 10) -> Dict:
        """
        Generate quiz questions from document text.
        
        Args:
            document_text: Full text content from document
            num_questions: Number of questions to generate
            
        Returns:
            Dictionary with quiz questions in structured format
        """
        try:
            prompt = f"""Generate {num_questions} quiz questions from the following document text.
Create a mix of question types: multiple choice, true/false, and short answer questions.

For each question, provide:
- question: The question text
- type: "multiple_choice", "true_false", or "short_answer"
- options: Array of options (for multiple choice only)
- correct_answer: The correct answer
- explanation: Brief explanation of why this is correct

Return the response as a valid JSON object with this structure:
{{
  "questions": [
    {{
      "question": "Question text here",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Explanation here"
    }}
  ]
}}

Document Text:
{document_text[:8000]}

Generate the quiz questions now:"""
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                }
            }
            
            response = self._make_request(self.api_endpoint, payload)
            response_text = response.get('response', '').strip()
            
            # Try to parse JSON from response
            import json
            import re
            
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                quiz_data = json.loads(json_match.group())
            else:
                # Fallback: try parsing entire response
                quiz_data = json.loads(response_text)
            
            logger.info(f"Generated quiz with {len(quiz_data.get('questions', []))} questions")
            return quiz_data
            
        except Exception as e:
            logger.error(f"Error generating quiz: {str(e)}")
            return {"questions": []}
    
    def generate_notes(self, document_text: str, format: str = 'outline') -> Dict:
        """
        Generate structured notes from document text.
        
        Args:
            document_text: Full text content from document
            format: Format of notes ('outline', 'summary', 'key_points')
            
        Returns:
            Dictionary with structured notes
        """
        try:
            format_instructions = {
                'outline': 'Create a hierarchical outline with main topics, subtopics, and key points',
                'summary': 'Create a comprehensive summary with main sections and important details',
                'key_points': 'Create a list of key points and important concepts'
            }
            
            instruction = format_instructions.get(format, format_instructions['outline'])
            
            prompt = f"""Create study notes from the following document text. Write these notes as if a student or learner is taking notes by hand - natural, personal, and easy to understand.

Write the notes in a conversational, human style:
- Use natural language and everyday words
- Include personal observations or connections when helpful
- Add brief reminders or "remember this" notes
- Use casual transitions between ideas
- Make it feel like someone actually wrote these while learning
- Keep it organized but not overly formal
- Include questions or things to explore further when relevant

Return the response as a valid JSON object with this structure:
{{
  "title": "Document Title",
  "sections": [
    {{
      "heading": "Section Heading",
      "content": "Write this section in a natural, conversational way. Include the main ideas but explain them like you're writing notes for yourself. Add personal insights, connections, or reminders where helpful.",
      "subsections": [
        {{
          "heading": "Subsection",
          "content": "Subsection content written naturally"
        }}
      ]
    }}
  ],
  "key_points": ["Key point written naturally", "Another important thing to remember", ...],
  "summary": "Write a brief, natural summary - like you're explaining what you learned to a friend"
}}

Document Text:
{document_text[:8000]}

Remember: Write these notes as if a real person is taking study notes - natural, personal, and easy to read. Avoid overly formal or robotic language.

Generate the notes now:"""
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,  # Higher temperature for more natural, human-like writing
                }
            }
            
            response = self._make_request(self.api_endpoint, payload)
            response_text = response.get('response', '').strip()
            
            # Try to parse JSON from response
            import json
            import re
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                notes_data = json.loads(json_match.group())
            else:
                notes_data = json.loads(response_text)
            
            logger.info(f"Generated notes in {format} format")
            return notes_data
            
        except Exception as e:
            logger.error(f"Error generating notes: {str(e)}")
            return {"sections": [], "key_points": [], "summary": ""}
    
    def generate_flashcards(self, document_text: str, num_cards: int = 20) -> Dict:
        """
        Generate flashcards from document text.
        
        Args:
            document_text: Full text content from document
            num_cards: Number of flashcards to generate
            
        Returns:
            Dictionary with flashcard pairs
        """
        try:
            prompt = f"""Generate {num_cards} flashcards from the following document text.
Create flashcards with:
- Q&A pairs (question on front, answer on back)
- Term-definition pairs (term on front, definition on back)
- Concept-explanation pairs (concept on front, explanation on back)

Return the response as a valid JSON object with this structure:
{{
  "cards": [
    {{
      "front": "Question or term",
      "back": "Answer or definition",
      "type": "qa" or "term_definition" or "concept"
    }}
  ]
}}

Document Text:
{document_text[:8000]}

Generate the flashcards now:"""
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                }
            }
            
            response = self._make_request(self.api_endpoint, payload)
            response_text = response.get('response', '').strip()
            
            # Try to parse JSON from response
            import json
            import re
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                flashcard_data = json.loads(json_match.group())
            else:
                flashcard_data = json.loads(response_text)
            
            logger.info(f"Generated {len(flashcard_data.get('cards', []))} flashcards")
            return flashcard_data
            
        except Exception as e:
            logger.error(f"Error generating flashcards: {str(e)}")
            return {"cards": []}

