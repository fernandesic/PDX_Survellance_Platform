"""
Django management command to index documents for RAG.
Usage: python manage.py index_rag_documents
"""

from django.core.management.base import BaseCommand
from utils.document_indexer import DocumentIndexer


class Command(BaseCommand):
    help = 'Index documents from database into RAG vector store'

    def add_arguments(self, parser):
        parser.add_argument(
            '--collection',
            type=str,
            default='all',
            help='Collection to index: star, espar, chw, readiness, glossary, or all'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing documents before indexing'
        )

    def handle(self, *args, **options):
        collection = options['collection']
        clear = options['clear']
        
        self.stdout.write(self.style.NOTICE('Starting RAG document indexing...'))
        
        indexer = DocumentIndexer()
        
        if clear:
            from utils.rag_service import rag_service
            if collection == 'all':
                for col in rag_service.COLLECTIONS:
                    rag_service.clear_collection(col)
                self.stdout.write('Cleared all collections')
            else:
                rag_service.clear_collection(collection)
                self.stdout.write(f'Cleared {collection} collection')
        
        if collection == 'all':
            results = indexer.index_all()
        else:
            results = {}
            if collection == 'star':
                results['star'] = indexer.index_star_data()
            elif collection == 'espar':
                results['espar'] = indexer.index_espar_data()
            elif collection == 'chw':
                results['chw'] = indexer.index_chw_data()
            elif collection == 'readiness':
                results['readiness'] = indexer.index_readiness_data()
            elif collection == 'glossary':
                results['glossary'] = indexer.index_glossary()
            else:
                self.stdout.write(self.style.ERROR(f'Unknown collection: {collection}'))
                return
        
        # Print results
        total = 0
        for col, count in results.items():
            self.stdout.write(f'  {col}: {count} documents')
            total += count
        
        self.stdout.write(self.style.SUCCESS(f'Successfully indexed {total} documents!'))
