from django.core.management.base import BaseCommand
from django.conf import settings
from documents.services.chromadb_service import ChromaDBService
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean ChromaDB data - delete all chunks or only orphaned chunks (without clerk_user_id)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Delete all chunks from ChromaDB (fresh start)',
        )
        parser.add_argument(
            '--orphaned',
            action='store_true',
            help='Delete only chunks without clerk_user_id in metadata',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
        chromadb_service = ChromaDBService(settings.CHROMADB_PATH)
        
        # Get current stats
        stats = chromadb_service.get_collection_stats()
        total_chunks = stats.get('total_chunks', 0)
        
        self.stdout.write(f"Current ChromaDB status: {total_chunks} chunks")
        
        if options['all']:
            # Delete all chunks
            if not options['yes']:
                confirm = input(
                    f"WARNING: This will delete ALL {total_chunks} chunks from ChromaDB. "
                    "This action cannot be undone. Type 'yes' to confirm: "
                )
                if confirm.lower() != 'yes':
                    self.stdout.write(self.style.ERROR('Operation cancelled'))
                    return
            
            self.stdout.write("Deleting all chunks from ChromaDB...")
            success = chromadb_service.delete_all_chunks()
            
            if success:
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully deleted all chunks from ChromaDB')
                )
            else:
                self.stdout.write(
                    self.style.ERROR('Failed to delete all chunks')
                )
        
        elif options['orphaned']:
            # Delete only orphaned chunks
            if not options['yes']:
                confirm = input(
                    "This will delete chunks without clerk_user_id in metadata. "
                    "Type 'yes' to confirm: "
                )
                if confirm.lower() != 'yes':
                    self.stdout.write(self.style.ERROR('Operation cancelled'))
                    return
            
            self.stdout.write("Deleting orphaned chunks from ChromaDB...")
            success = chromadb_service.delete_orphaned_chunks()
            
            if success:
                # Get updated stats
                stats_after = chromadb_service.get_collection_stats()
                remaining = stats_after.get('total_chunks', 0)
                deleted = total_chunks - remaining
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully deleted {deleted} orphaned chunks. '
                        f'{remaining} chunks remaining.'
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR('Failed to delete orphaned chunks')
                )
        
        else:
            self.stdout.write(self.style.ERROR(
                'Please specify --all or --orphaned option.\n'
                'Use --all to delete all chunks (fresh start)\n'
                'Use --orphaned to delete only chunks without clerk_user_id'
            ))

