import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from documents.models import Document
from documents.services.ollama_service import OllamaService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Generate summaries for all documents using Ollama AI'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force regeneration of summaries, even if they already exist',
        )
        parser.add_argument(
            '--document-id',
            type=str,
            help='Generate summary for a specific document ID only',
        )
    
    def handle(self, *args, **options):
        force = options['force']
        document_id = options.get('document_id')
        
        self.stdout.write(
            self.style.SUCCESS('Starting summary generation...')  # type: ignore
        )
        
        try:
            # Initialize Ollama service
            ollama_service = OllamaService(
                api_key=settings.OLLAMA_API_KEY,
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL
            )
            
            # Get documents to process
            if document_id:
                documents = Document.objects.filter(id=document_id)  # type: ignore
                if not documents.exists():
                    self.stdout.write(
                        self.style.ERROR(f'Document with ID {document_id} not found')  # type: ignore
                    )
                    return
            else:
                if force:
                    documents = Document.objects.all()  # type: ignore
                else:
                    documents = Document.objects.filter(summary__isnull=True)  # type: ignore
            
            if not documents.exists():
                self.stdout.write(
                    self.style.WARNING('No documents found to process')  # type: ignore
                )
                return
            
            self.stdout.write(f'Found {documents.count()} documents to process')
            
            # Process each document
            processed_count = 0
            skipped_count = 0
            error_count = 0
            
            for document in documents:
                try:
                    # Check if summary already exists
                    if not force and document.summary:
                        self.stdout.write(f'Skipping {document.filename} (summary already exists)')
                        skipped_count += 1
                        continue
                    
                    self.stdout.write(f'Generating summary for {document.filename}...')
                    
                    # Get document text from chunks
                    chunks = document.chunks.all().order_by('chunk_index')  # type: ignore
                    if not chunks.exists():
                        self.stdout.write(
                            self.style.WARNING(f'No chunks found for {document.filename}')  # type: ignore
                        )
                        continue
                    
                    # Combine chunks into full text
                    full_text = ' '.join([chunk.text for chunk in chunks])
                    
                    # Generate summary with increased length
                    summary = ollama_service.generate_summary(full_text, document.title or document.filename, max_length=1000)
                    
                    if summary:
                        # Update document with summary
                        document.summary = summary
                        document.summary_generated_at = timezone.now()
                        document.save()
                        
                        processed_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'Successfully generated summary for {document.filename}')  # type: ignore
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f'Failed to generate summary for {document.filename}')  # type: ignore
                        )
                        error_count += 1
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f'Error generating summary for {document.filename}: {str(e)}')
                    self.stdout.write(
                        self.style.ERROR(f'Error generating summary for {document.filename}: {str(e)}')  # type: ignore
                    )
            
            # Summary
            self.stdout.write('\n' + '='*50)
            self.stdout.write(
                self.style.SUCCESS('Summary Generation Complete!')  # type: ignore
            )
            self.stdout.write(f'Processed: {processed_count}')
            self.stdout.write(f'Skipped: {skipped_count}')
            self.stdout.write(f'Errors: {error_count}')
            
        except Exception as e:
            logger.error(f'Fatal error during summary generation: {str(e)}')
            self.stdout.write(
                self.style.ERROR(f'Fatal error: {str(e)}')  # type: ignore
            )
            raise