"""
AFRO Sentinel Watchtower - Disease Detector
Multilingual disease detection using keyword matching.
Uses the DiseaseKeyword model for keyword lookup.
"""

import re
from typing import Optional, Dict, Any, List, Tuple
from sentinel.models import DiseaseKeyword, SignalPriority


class DiseaseDetector:
    """Detect diseases in text using multilingual keyword matching."""
    
    def __init__(self):
        self._keyword_cache: Dict[str, List[str]] = {}
        self._disease_priority: Dict[str, str] = {}
        self._disease_category: Dict[str, str] = {}
        self._cached = False
    
    def _load_keywords(self):
        """Load keywords from database into memory cache."""
        if self._cached:
            return
            
        for disease in DiseaseKeyword.objects.all():
            keywords = disease.get_all_keywords()
            self._keyword_cache[disease.disease_name] = keywords
            self._disease_priority[disease.disease_name] = disease.default_priority
            self._disease_category[disease.disease_name] = disease.category
        
        self._cached = True
    
    def invalidate_cache(self):
        """Clear the keyword cache (call after updating DiseaseKeyword)."""
        self._keyword_cache = {}
        self._disease_priority = {}
        self._disease_category = {}
        self._cached = False
    
    def detect_diseases(self, text: str) -> List[Dict[str, Any]]:
        """
        Detect all diseases mentioned in text.
        
        Returns:
            List of dicts with:
            - 'name': Disease name
            - 'category': Disease category
            - 'priority': Default priority
            - 'matches': List of matched keywords
            - 'confidence': Match confidence (0-100)
        """
        self._load_keywords()
        
        text_lower = text.lower()
        detections = []
        
        for disease_name, keywords in self._keyword_cache.items():
            matches = []
            for keyword in keywords:
                # Use word boundary matching
                pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
                if re.search(pattern, text_lower):
                    matches.append(keyword)
            
            if matches:
                # Calculate confidence based on number and specificity of matches
                confidence = min(50 + len(matches) * 15, 100)
                
                # Boost for exact disease name match
                if disease_name.lower() in text_lower:
                    confidence = min(confidence + 20, 100)
                
                detections.append({
                    'name': disease_name,
                    'category': self._disease_category.get(disease_name),
                    'priority': self._disease_priority.get(disease_name),
                    'matches': matches,
                    'confidence': confidence
                })
        
        # Sort by confidence (highest first)
        detections.sort(key=lambda x: x['confidence'], reverse=True)
        return detections
    
    def get_primary_disease(self, text: str) -> Optional[Dict[str, Any]]:
        """Get the primary (most confident) disease detection."""
        detections = self.detect_diseases(text)
        return detections[0] if detections else None
    
    def classify_priority(self, text: str) -> str:
        """
        Classify signal priority based on disease and outbreak severity.
        
        Rules:
        - VHF diseases (Ebola, Marburg, Lassa) → P1
        - High case counts (>100) → boost priority
        - Death mentions → boost priority
        - Vaccine preventable outbreaks → P2
        - Unknown disease → P3
        """
        detection = self.get_primary_disease(text)
        
        if detection:
            base_priority = detection['priority']
        else:
            base_priority = SignalPriority.P3
        
        # Priority boost for severity indicators
        severity_boosts = [
            (r'\b(\d{3,})\s*(cases?|confirmed|suspected)\b', 1),  # 100+ cases
            (r'\b(\d+)\s*(deaths?|died|killed)\b', 1),  # Any deaths
            (r'\b(fatal|deadly|emergency|urgent|crisis)\b', 1),
            (r'\b(spreading|outbreak|epidemic)\b', 0),
        ]
        
        boost = 0
        for pattern, boost_val in severity_boosts:
            if re.search(pattern, text, re.IGNORECASE):
                boost += boost_val
        
        # Apply boost (lower priority number = higher severity)
        priority_order = ['P1', 'P2', 'P3', 'P4']
        current_idx = priority_order.index(base_priority)
        new_idx = max(0, current_idx - boost)
        
        return priority_order[new_idx]


# Singleton instance
disease_detector = DiseaseDetector()
