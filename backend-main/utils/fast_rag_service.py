"""
Fast RAG Service using sentence-transformers for local embeddings.
Much faster than Ollama API calls (~10ms per embedding vs 30s+).
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from django.db import DatabaseError

logger = logging.getLogger(__name__)

# DB read + vector store write failure modes for the indexer.
_INDEX_ERRORS = (DatabaseError, AttributeError, ValueError, TypeError, KeyError)

# Lazy load to avoid slow import on startup
_model = None
_documents = {}  # Simple in-memory store per collection


def get_embedding_model():
    """Lazy load the embedding model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Use a small, fast model optimized for semantic search
            _model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("[RAG] Loaded sentence-transformers model: all-MiniLM-L6-v2")
        except ImportError:
            logger.warning("[RAG] sentence-transformers not installed, using fallback")
            _model = None
    return _model


@dataclass
class Document:
    """A document in the vector store."""
    id: str
    content: str
    embedding: List[float]
    metadata: Dict[str, Any]
    collection: str


class FastRAGService:
    """
    Fast RAG service using sentence-transformers for embeddings.
    Uses simple in-memory cosine similarity search.
    """
    
    COLLECTIONS = ['star', 'espar', 'chw', 'readiness', 'glossary']
    
    def __init__(self):
        self.documents: Dict[str, List[Document]] = {c: [] for c in self.COLLECTIONS}
        self._indexed = False
    
    def embed(self, text: str) -> List[float]:
        """Generate embedding for text."""
        model = get_embedding_model()
        if model is None:
            return []
        return model.encode(text).tolist()
    
    def add_document(
        self,
        collection: str,
        doc_id: str,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """Add a document to a collection."""
        if collection not in self.documents:
            return False
        
        embedding = self.embed(content)
        if not embedding:
            return False
        
        doc = Document(
            id=doc_id,
            content=content,
            embedding=embedding,
            metadata=metadata or {},
            collection=collection
        )
        self.documents[collection].append(doc)
        return True
    
    def search(
        self,
        query: str,
        collections: List[str] = None,
        top_k: int = 5
    ) -> List[Document]:
        """Search for similar documents."""
        if collections is None:
            collections = self.COLLECTIONS
        
        query_embedding = self.embed(query)
        if not query_embedding:
            return []
        
        # Calculate similarities across all requested collections
        all_results = []
        for col in collections:
            if col not in self.documents:
                continue
            
            for doc in self.documents[col]:
                similarity = self._cosine_similarity(query_embedding, doc.embedding)
                all_results.append((doc, similarity))
        
        # Sort by similarity (descending)
        all_results.sort(key=lambda x: x[1], reverse=True)
        
        return [doc for doc, _ in all_results[:top_k]]
    
    def build_context(
        self,
        query: str,
        collections: List[str] = None,
        max_docs: int = 5
    ) -> str:
        """Build context string from retrieved documents."""
        documents = self.search(query, collections, max_docs)
        
        if not documents:
            return ""
        
        context_parts = ["Retrieved context from database:"]
        
        for i, doc in enumerate(documents, 1):
            source = doc.metadata.get('source', 'unknown')
            context_parts.append(f"\n[Source {i}: {doc.collection.upper()} - {source}]")
            context_parts.append(doc.content)
        
        context_parts.append("\nUse this information to answer the question accurately.")
        
        return "\n".join(context_parts)
    
    def get_collection_stats(self) -> Dict[str, int]:
        """Get document counts per collection."""
        return {col: len(docs) for col, docs in self.documents.items()}
    
    def clear_collection(self, collection: str) -> bool:
        """Clear all documents from a collection."""
        if collection not in self.documents:
            return False
        self.documents[collection] = []
        return True
    
    def is_indexed(self) -> bool:
        """Check if any documents are indexed."""
        return sum(len(docs) for docs in self.documents.values()) > 0
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity."""
        if len(a) != len(b) or not a:
            return 0.0
        
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x ** 2 for x in a) ** 0.5
        norm_b = sum(x ** 2 for x in b) ** 0.5
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot / (norm_a * norm_b)
    
    def index_from_database(self, limit_per_collection: int = 100) -> Dict[str, int]:
        """
        Index data from database into RAG.
        Call this on app startup or manually.
        """
        stats = {}
        
        # Index STAR data
        try:
            from stardata.models import StarData
            from django.db.models.functions import Trim
            from utils.severity_utils import normalize_severity
            
            qs = StarData.objects.annotate(
                cleaned_country=Trim('country'),
                cleaned_hazard=Trim('hazard'),
                cleaned_severity=Trim('severity'),
                cleaned_type=Trim('main_type_of_hazard'),
            )[:limit_per_collection]
            
            count = 0
            for item in qs:
                severity = normalize_severity(item.cleaned_severity or '')
                content = f"""Country: {item.cleaned_country}
Hazard: {item.cleaned_hazard}
Type: {item.cleaned_type}
Severity: {severity}
Geographic Area: {item.geographical_area or 'N/A'}"""
                
                if self.add_document('star', f'star_{item.id}', content, {
                    'source': 'STAR Database',
                    'country': item.cleaned_country,
                    'hazard': item.cleaned_hazard,
                    'severity': severity,
                }):
                    count += 1
            stats['star'] = count
            logger.info(f"[RAG] Indexed {count} STAR documents")
        except _INDEX_ERRORS as e:
            logger.error(f"[RAG] Error indexing STAR: {e}")
            stats['star'] = 0
        
        # Index e-SPAR data
        try:
            from espar.models import Espar, Indicator
            
            espars = Espar.objects.select_related('sheet')[:limit_per_collection]
            
            count = 0
            for espar in espars:
                indicators = Indicator.objects.filter(espar=espar)[:10]
                scores = [ind.scaled_score() for ind in indicators]
                avg = sum(scores) / len(scores) if scores else 0
                
                content = f"""Country: {espar.states}
Region: {espar.region}
Year: {espar.sheet.name if espar.sheet else 'N/A'}
Average Capacity Score: {avg:.1f}/5
Number of indicators assessed: {len(scores)}"""
                
                if self.add_document('espar', f'espar_{espar.id}', content, {
                    'source': 'IHR/e-SPAR Database',
                    'country': espar.states,
                    'region': espar.region,
                    'avg_score': avg,
                }):
                    count += 1
            stats['espar'] = count
            logger.info(f"[RAG] Indexed {count} e-SPAR documents")
        except _INDEX_ERRORS as e:
            logger.error(f"[RAG] Error indexing e-SPAR: {e}")
            stats['espar'] = 0
        
        # Index CHW data
        try:
            from chwfolder.models import Country as CHWCountry
            
            countries = CHWCountry.objects.all()[:limit_per_collection]
            
            count = 0
            for c in countries:
                content = f"""Country: {c.country}
Total CHWs: {c.total_chws:,}
CHWs per 10,000 population: {c.chws_per_10000:.1f}
Population: {c.population:,}"""
                
                if self.add_document('chw', f'chw_{c.id}', content, {
                    'source': 'CHW Database',
                    'country': c.country,
                    'total_chws': c.total_chws,
                }):
                    count += 1
            stats['chw'] = count
            logger.info(f"[RAG] Indexed {count} CHW documents")
        except _INDEX_ERRORS as e:
            logger.error(f"[RAG] Error indexing CHW: {e}")
            stats['chw'] = 0
        
        # Add glossary terms
        glossary = [
            ("IHR", "International Health Regulations - legally binding agreement for disease prevention"),
            ("e-SPAR", "Electronic State Parties Annual Report - self-assessment tool for IHR capacities. Scores 1-5."),
            ("STAR", "Strategic Tool for Assessing Risks - WHO tool for health hazard analysis. Severity: Low, Moderate, High, Very High."),
            ("CHW", "Community Health Worker - health workers in communities providing education and care."),
            ("WHO AFRO", "World Health Organization African Regional Office"),
        ]
        
        count = 0
        for term, definition in glossary:
            if self.add_document('glossary', f'glossary_{term}', f"{term}: {definition}", {'source': 'WHO Glossary'}):
                count += 1
        stats['glossary'] = count
        
        self._indexed = True
        return stats


# Singleton instance
fast_rag_service = FastRAGService()
