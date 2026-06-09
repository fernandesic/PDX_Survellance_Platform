"""
RAG Service for health intelligence platform.
Uses ChromaDB for vector storage and Ollama for embeddings.
"""

import os
import json
import hashlib
import requests
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class RetrievedDocument:
    """A document retrieved from the vector store."""
    content: str
    source: str
    program: str  # star, espar, chw, readiness
    metadata: Dict[str, Any]
    distance: float


class OllamaEmbeddings:
    """Generate embeddings using Ollama's embedding API."""
    
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3:latest"):
        self.base_url = base_url
        self.model = model
    
    def embed(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        try:
            response = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=30
            )
            if response.status_code == 200:
                return response.json().get("embedding", [])
            else:
                # Return empty embedding on error
                return []
        except requests.exceptions.RequestException:
            return []
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        return [self.embed(text) for text in texts]


class SimpleVectorStore:
    """
    Simple in-memory vector store using cosine similarity.
    No external dependencies required.
    """
    
    def __init__(self):
        self.documents: List[Dict[str, Any]] = []
        self.embeddings: List[List[float]] = []
    
    def add(self, doc_id: str, content: str, embedding: List[float], metadata: Dict[str, Any] = None):
        """Add a document to the store."""
        self.documents.append({
            "id": doc_id,
            "content": content,
            "metadata": metadata or {}
        })
        self.embeddings.append(embedding)
    
    def search(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar documents."""
        if not self.embeddings or not query_embedding:
            return []
        
        # Calculate cosine similarities
        similarities = []
        for i, emb in enumerate(self.embeddings):
            sim = self._cosine_similarity(query_embedding, emb)
            similarities.append((i, sim))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Return top_k results
        results = []
        for idx, sim in similarities[:top_k]:
            doc = self.documents[idx].copy()
            doc["distance"] = 1 - sim  # Convert similarity to distance
            results.append(doc)
        
        return results
    
    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(a) != len(b) or not a or not b:
            return 0.0
        
        dot_product = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x ** 2 for x in a) ** 0.5
        norm_b = sum(x ** 2 for x in b) ** 0.5
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        return dot_product / (norm_a * norm_b)
    
    def count(self) -> int:
        """Return number of documents in store."""
        return len(self.documents)
    
    def clear(self):
        """Clear all documents."""
        self.documents = []
        self.embeddings = []


class RAGService:
    """
    Retrieval-Augmented Generation service.
    Manages document collections and provides context retrieval for LLM queries.
    """
    
    # Collection names for each program
    COLLECTIONS = ["star", "espar", "chw", "readiness", "glossary"]
    
    def __init__(self):
        self.embeddings = OllamaEmbeddings()
        self.collections: Dict[str, SimpleVectorStore] = {}
        
        # Initialize collections
        for name in self.COLLECTIONS:
            self.collections[name] = SimpleVectorStore()
    
    def add_document(
        self,
        collection: str,
        doc_id: str,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """Add a document to a collection."""
        if collection not in self.collections:
            return False
        
        # Generate embedding
        embedding = self.embeddings.embed(content)
        if not embedding:
            return False
        
        # Add to collection
        self.collections[collection].add(
            doc_id=doc_id,
            content=content,
            embedding=embedding,
            metadata=metadata
        )
        return True
    
    def search(
        self,
        query: str,
        collections: List[str] = None,
        top_k: int = 5
    ) -> List[RetrievedDocument]:
        """
        Search for relevant documents across collections.
        
        Args:
            query: The search query
            collections: List of collections to search (None = all)
            top_k: Number of results per collection
        
        Returns:
            List of retrieved documents sorted by relevance
        """
        if collections is None:
            collections = self.COLLECTIONS
        
        # Generate query embedding
        query_embedding = self.embeddings.embed(query)
        if not query_embedding:
            return []
        
        # Search each collection
        all_results = []
        for col_name in collections:
            if col_name not in self.collections:
                continue
            
            results = self.collections[col_name].search(query_embedding, top_k)
            for result in results:
                all_results.append(RetrievedDocument(
                    content=result["content"],
                    source=result["metadata"].get("source", "unknown"),
                    program=col_name,
                    metadata=result["metadata"],
                    distance=result["distance"]
                ))
        
        # Sort by distance (lower is better)
        all_results.sort(key=lambda x: x.distance)
        
        return all_results[:top_k]
    
    def build_context(
        self,
        query: str,
        collections: List[str] = None,
        max_docs: int = 5
    ) -> str:
        """
        Build context string for LLM from retrieved documents.
        
        Returns formatted context with source citations.
        """
        documents = self.search(query, collections, max_docs)
        
        if not documents:
            return ""
        
        context_parts = ["Retrieved context from database:"]
        
        for i, doc in enumerate(documents, 1):
            context_parts.append(f"\n[Source {i}: {doc.program.upper()} - {doc.source}]")
            context_parts.append(doc.content)
        
        context_parts.append("\nPlease cite the source numbers when using this information.")
        
        return "\n".join(context_parts)
    
    def get_collection_stats(self) -> Dict[str, int]:
        """Get document counts for each collection."""
        return {name: col.count() for name, col in self.collections.items()}
    
    def clear_collection(self, collection: str) -> bool:
        """Clear all documents from a collection."""
        if collection not in self.collections:
            return False
        self.collections[collection].clear()
        return True


# Singleton instance
rag_service = RAGService()
