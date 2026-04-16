"""
Custom runserver command that suppresses HTTPS errors in development.
"""
import sys
from django.core.management.commands.runserver import Command as RunserverCommand
from django.conf import settings


class Command(RunserverCommand):
    """
    Custom runserver that filters out HTTPS-related errors in development.
    These errors occur when browsers try to upgrade HTTP to HTTPS.
    """
    
    def handle(self, *args, **options):
        # In development, suppress HTTPS errors by filtering stderr
        if settings.DEBUG:
            # Create a filter for stderr
            original_stderr = sys.stderr
            
            class FilteredStderr:
                """Filter stderr to suppress HTTPS-related errors in development."""
                def __init__(self, original):
                    self.original = original
                
                def write(self, text):
                    # Filter out HTTPS-related error messages
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
                    # These often contain specific byte patterns
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
                    
                    # Write everything else to original stderr
                    self.original.write(text)
                
                def flush(self):
                    self.original.flush()
                
                def __getattr__(self, name):
                    return getattr(self.original, name)
            
            sys.stderr = FilteredStderr(original_stderr)
        
        try:
            super().handle(*args, **options)
        finally:
            # Restore original stderr
            if settings.DEBUG:
                sys.stderr = original_stderr

