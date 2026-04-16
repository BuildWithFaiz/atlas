#!/usr/bin/env python
"""
Simple run script for the RAG backend.
"""
import os
import sys
import django
from pathlib import Path

# Add the project directory to Python path
project_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(project_dir))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
django.setup()

# Filter out HTTPS errors in development (browsers trying to upgrade HTTP to HTTPS)
if os.getenv('DEBUG', 'True').lower() == 'true':
    original_stderr = sys.stderr
    
    class FilteredStderr:
        """Filter stderr to suppress HTTPS-related errors in development."""
        def __init__(self, original):
            self.original = original
        
        def write(self, text):
            # Suppress HTTPS-related error messages
            # Check for various error message formats
            text_str = str(text)
            error_phrases = [
                "You're accessing the development server over HTTPS",
                'Bad request version',
                'Bad request syntax',
                'Bad HTTP/0.9 request type',
                'code 400, message',
                'code 400',
            ]
            
            # Also check for binary/encoded HTTPS handshake attempts
            is_https_handshake = False
            if isinstance(text, bytes):
                # Check for TLS handshake patterns (starts with 0x16 for TLS)
                if len(text) > 0 and text[0] == 0x16:
                    is_https_handshake = True
            elif isinstance(text, str):
                # Check for TLS handshake in string representation
                if '\x16' in text or '\\x16' in text:
                    is_https_handshake = True
            
            # Suppress if any error phrase is found or HTTPS handshake detected
            if any(phrase in text_str for phrase in error_phrases) or is_https_handshake:
                return  # Suppress these messages
            
            self.original.write(text)
        
        def flush(self):
            self.original.flush()
        
        def __getattr__(self, name):
            return getattr(self.original, name)
    
    sys.stderr = FilteredStderr(original_stderr)

from django.core.management import execute_from_command_line

if __name__ == '__main__':
    execute_from_command_line(['manage.py', 'runserver', '0.0.0.0:8000'])
