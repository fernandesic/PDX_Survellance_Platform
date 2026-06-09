"""
Management command to index data into RAG vector store.
Run with: python manage.py index_rag
"""

from django.core.management.base import BaseCommand
from django.db.models.functions import Trim
import logging

from utils.rag_service import rag_service

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Index database data into RAG vector store for semantic search'

    def add_arguments(self, parser):
        parser.add_argument(
            '--collection',
            type=str,
            help='Specific collection to index (star, espar, chw, readiness, glossary)',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Limit number of documents per collection (default: 100)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing documents before indexing',
        )

    def handle(self, *args, **options):
        collection = options.get('collection')
        limit = options.get('limit', 100)
        clear = options.get('clear', False)
        
        self.stdout.write(self.style.NOTICE('Starting RAG indexing...'))
        
        if collection:
            if clear:
                rag_service.clear_collection(collection)
                self.stdout.write(f'Cleared collection: {collection}')
            self._index_collection(collection, limit)
        else:
            # Index all collections
            for col in ['star', 'espar', 'chw', 'readiness']:
                if clear:
                    rag_service.clear_collection(col)
                    self.stdout.write(f'Cleared collection: {col}')
                self._index_collection(col, limit)
        
        # Print stats
        stats = rag_service.get_collection_stats()
        self.stdout.write(self.style.SUCCESS('\nIndexing complete!'))
        self.stdout.write('Collection stats:')
        for name, count in stats.items():
            self.stdout.write(f'  {name}: {count} documents')

    def _index_collection(self, collection: str, limit: int):
        """Index a specific collection."""
        self.stdout.write(f'\nIndexing {collection}...')
        
        try:
            if collection == 'star':
                self._index_star(limit)
            elif collection == 'espar':
                self._index_espar(limit)
            elif collection == 'chw':
                self._index_chw(limit)
            elif collection == 'readiness':
                self._index_readiness(limit)
            elif collection == 'glossary':
                self._index_glossary()
            else:
                self.stdout.write(self.style.WARNING(f'Unknown collection: {collection}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error indexing {collection}: {e}'))

    def _index_star(self, limit: int):
        """Index STAR hazard data."""
        from stardata.models import StarData
        
        qs = StarData.objects.annotate(
            cleaned_country=Trim('country'),
            cleaned_hazard=Trim('hazard'),
            cleaned_severity=Trim('severity'),
            cleaned_type=Trim('main_type_of_hazard'),
        )[:limit]
        
        count = 0
        for item in qs:
            doc_id = f"star_{item.id}"
            content = f"""Country: {item.cleaned_country}
Hazard: {item.cleaned_hazard}
Type: {item.cleaned_type}
Severity: {item.cleaned_severity}
Geographic Area: {item.geographical_area or 'N/A'}
Year: {item.year or 'N/A'}"""
            
            metadata = {
                'source': 'STAR Database',
                'country': item.cleaned_country,
                'hazard': item.cleaned_hazard,
                'severity': item.cleaned_severity,
            }
            
            if rag_service.add_document('star', doc_id, content, metadata):
                count += 1
        
        self.stdout.write(f'  Indexed {count} STAR documents')

    def _index_espar(self, limit: int):
        """Index e-SPAR capacity data."""
        from espar.models import Espar, Indicator
        
        espars = Espar.objects.select_related('sheet')[:limit]
        
        count = 0
        for espar in espars:
            indicators = Indicator.objects.filter(espar=espar)[:15]
            
            indicator_text = []
            for ind in indicators:
                indicator_text.append(f"  - {ind.indicator_code}: {ind.scaled_score():.1f}/5")
            
            doc_id = f"espar_{espar.id}"
            content = f"""Country: {espar.states}
Region: {espar.region}
Year: {espar.sheet.name if espar.sheet else 'N/A'}
IHR/e-SPAR Capacity Indicators:
{chr(10).join(indicator_text)}"""
            
            metadata = {
                'source': 'IHR/e-SPAR Database',
                'country': espar.states,
                'region': espar.region,
                'year': espar.sheet.name if espar.sheet else None,
            }
            
            if rag_service.add_document('espar', doc_id, content, metadata):
                count += 1
        
        self.stdout.write(f'  Indexed {count} e-SPAR documents')

    def _index_chw(self, limit: int):
        """Index CHW data."""
        from chwfolder.models import Country, Region, District
        
        countries = Country.objects.all()[:limit]
        
        count = 0
        for country in countries:
            regions = Region.objects.filter(country=country)[:5]
            region_text = []
            for r in regions:
                districts = District.objects.filter(region=r)[:3]
                district_info = ', '.join([f"{d.district_name}" for d in districts])
                region_text.append(f"  - {r.region_name}: {district_info}")
            
            doc_id = f"chw_{country.id}"
            content = f"""Country: {country.country}
Total CHWs: {country.total_chws:,}
CHWs per 10,000 population: {country.chws_per_10000:.1f}
Population: {country.population:,}
Key Regions:
{chr(10).join(region_text) if region_text else '  No region data'}"""
            
            metadata = {
                'source': 'CHW Database',
                'country': country.country,
                'total_chws': country.total_chws,
                'chws_per_10k': country.chws_per_10000,
            }
            
            if rag_service.add_document('chw', doc_id, content, metadata):
                count += 1
        
        self.stdout.write(f'  Indexed {count} CHW documents')

    def _index_readiness(self, limit: int):
        """Index Readiness data - summary per hazard type."""
        from readiness.models import ArboVirus, Cholera, Mpox, Marburg
        
        count = 0
        
        # Index summary for each readiness type
        readiness_types = [
            ('ArboVirus', ArboVirus),
            ('Cholera', Cholera),
            ('Mpox', Mpox),
            ('Marburg', Marburg),
        ]
        
        for name, model in readiness_types:
            try:
                qs = model.objects.all()
                total = qs.count()
                answered = qs.filter(question_score__gt=0).count()
                completion = (answered / total * 100) if total > 0 else 0
                
                countries = list(qs.values_list('country', flat=True).distinct()[:10])
                
                doc_id = f"readiness_{name.lower()}"
                content = f"""Readiness Assessment: {name}
Total Questions: {total}
Answered Questions: {answered}
Completion Rate: {completion:.1f}%
Countries Assessed: {', '.join(countries[:5])}"""
                
                metadata = {
                    'source': f'{name} Readiness',
                    'hazard_type': name,
                    'completion_pct': completion,
                }
                
                if rag_service.add_document('readiness', doc_id, content, metadata):
                    count += 1
            except Exception as e:
                self.stdout.write(f'  Skipped {name}: {e}')
        
        self.stdout.write(f'  Indexed {count} Readiness documents')

    def _index_glossary(self):
        """Index WHO health terminology glossary."""
        # Add key health definitions
        glossary_entries = [
            {
                'id': 'glossary_ihr',
                'content': """IHR (International Health Regulations)
Definition: The IHR (2005) is a legally binding international agreement that helps countries work together to save lives and livelihoods from the international spread of diseases.
Key aspects: All WHO Member States are bound by the IHR. It requires countries to report certain disease outbreaks and public health events to WHO.""",
            },
            {
                'id': 'glossary_espar',
                'content': """e-SPAR (Electronic State Parties Annual Report)
Definition: A self-assessment and monitoring tool for countries to report on their core capacities under the IHR.
Key aspects: Measures 15 capacity areas including surveillance, laboratory, response, and points of entry.""",
            },
            {
                'id': 'glossary_chw',
                'content': """CHW (Community Health Worker)
Definition: Health workers based in communities who provide health education, referral and follow up, case management, and basic preventive health care.
Key aspects: Essential for primary health care delivery, especially in underserved areas.""",
            },
            {
                'id': 'glossary_star',
                'content': """STAR (Strategic Tool for Assessing Risks)
Definition: A WHO tool for analyzing and prioritizing health hazards and risks at country level.
Severity levels: Low, Moderate, High, Very High
Key aspects: Helps countries prepare for potential health emergencies.""",
            },
        ]
        
        count = 0
        for entry in glossary_entries:
            if rag_service.add_document(
                'glossary',
                entry['id'],
                entry['content'],
                {'source': 'WHO Glossary'}
            ):
                count += 1
        
        self.stdout.write(f'  Indexed {count} Glossary entries')
