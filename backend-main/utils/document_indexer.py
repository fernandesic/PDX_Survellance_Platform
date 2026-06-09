"""
Document Indexer for RAG system.
Indexes health data from database models into vector collections.
"""

import logging
import hashlib
from typing import List, Dict, Any, Optional
from django.db.models import QuerySet

from utils.rag_service import rag_service

logger = logging.getLogger(__name__)


class DocumentIndexer:
    """
    Indexes documents from Django models into RAG collections.
    Call index_all() to populate all collections from the database.
    """
    
    def __init__(self):
        self.rag = rag_service
        self.indexed_count = {
            "star": 0,
            "espar": 0,
            "chw": 0,
            "readiness": 0,
            "glossary": 0
        }
    
    def generate_doc_id(self, *args) -> str:
        """Generate a unique document ID from content parts."""
        content = "|".join(str(arg) for arg in args)
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    def index_star_data(self) -> int:
        """Index STAR hazard data from database."""
        from stardata.models import StarData
        
        count = 0
        hazards = StarData.objects.all()
        
        for hazard in hazards:
            # Create document content
            content = f"""
Country: {hazard.country}
Hazard: {hazard.hazard}
Severity: {hazard.severity}
Status: {hazard.status if hasattr(hazard, 'status') else 'N/A'}
Description: Seasonal risk assessment for {hazard.hazard} in {hazard.country}
"""
            
            doc_id = self.generate_doc_id("star", hazard.country, hazard.hazard)
            
            success = self.rag.add_document(
                collection="star",
                doc_id=doc_id,
                content=content.strip(),
                metadata={
                    "source": f"{hazard.country} - {hazard.hazard}",
                    "country": hazard.country,
                    "hazard": hazard.hazard,
                    "severity": hazard.severity
                }
            )
            
            if success:
                count += 1
        
        self.indexed_count["star"] = count
        return count
    
    def index_espar_data(self) -> int:
        """Index IHR/e-SPAR capacity data from database."""
        from espar.models import Espar, Indicator
        from utils.constants import CAPACITIES
        
        count = 0
        espars = Espar.objects.all()
        
        for espar in espars:
            indicators = Indicator.objects.filter(espar=espar)
            
            for indicator in indicators:
                # Get capacity name from code
                capacity_code = indicator.code.split(".")[0] + "." + indicator.code.split(".")[1] if "." in indicator.code else indicator.code
                capacity_name = CAPACITIES.get(capacity_code, indicator.code)
                
                content = f"""
Country: {espar.states}
Year: {espar.sheet.name if espar.sheet else 'N/A'}
Capacity Code: {indicator.code}
Capacity Name: {capacity_name}
Score: {indicator.value}/5
Description: IHR core capacity assessment for {espar.states}. 
{capacity_name} measures the country's ability to {self._get_capacity_description(capacity_code)}.
"""
                
                doc_id = self.generate_doc_id("espar", espar.states, indicator.code)
                
                success = self.rag.add_document(
                    collection="espar",
                    doc_id=doc_id,
                    content=content.strip(),
                    metadata={
                        "source": f"{espar.states} - {indicator.code}",
                        "country": espar.states,
                        "code": indicator.code,
                        "score": indicator.value
                    }
                )
                
                if success:
                    count += 1
        
        self.indexed_count["espar"] = count
        return count
    
    def index_chw_data(self) -> int:
        """Index CHW (Community Health Worker) data from database."""
        from chwfolder.models import Country, Region, District
        
        count = 0
        countries = Country.objects.all()
        
        for country in countries:
            content = f"""
Country: {country.country}
Total CHWs: {country.total_chws:,}
CHWs per 10,000 population: {country.chws_per_10000:.2f}
Population (2024): {country.population_2024:,}
Total Regions: {country.total_regions}
Total Districts: {country.total_districts}
Description: Community Health Worker distribution data for {country.country}.
"""
            
            doc_id = self.generate_doc_id("chw", country.country)
            
            success = self.rag.add_document(
                collection="chw",
                doc_id=doc_id,
                content=content.strip(),
                metadata={
                    "source": country.country,
                    "country": country.country,
                    "total_chws": country.total_chws,
                    "chws_per_10k": country.chws_per_10000
                }
            )
            
            if success:
                count += 1
        
        self.indexed_count["chw"] = count
        return count
    
    def index_readiness_data(self) -> int:
        """Index Readiness indicator data from database."""
        try:
            from django.apps import apps
            from django.db.models import Avg
        except ImportError as e:
            logger.error("Import error during readiness indexing: %s", e)
            return 0
        
        count = 0
        
        # List of model names to index
        disease_model_names = [
            "Cholera", "ArboVirus", "Mpox", "Marburg", "Meningitis",
            "LassaFever", "RiftValleyFever", "NaturalDisaster"
        ]
        
        for disease_name in disease_model_names:
            try:
                model = apps.get_model('readiness', disease_name)
            except LookupError:
                logger.warning("Model %s not found in readiness app", disease_name)
                continue

            # Get all unique countries for this disease
            countries = model.objects.values_list('country', flat=True).distinct()
            logger.debug("Checking %s: Found %d countries", disease_name, len(countries))
            
            for country in countries:
                if not country: continue
                
                try:
                    # Get all records for this country/disease
                    records = model.objects.filter(country=country)
                    
                    if not records.exists():
                        continue
                        
                    # Calculate overall score
                    avg_score = records.aggregate(Avg('question_score'))['question_score__avg']
                    avg_score = float(avg_score) if avg_score else 0.0
                    
                    # Group by category to find gaps
                    categories = {}
                    for r in records:
                        if not r.category: continue
                        if r.category not in categories:
                            categories[r.category] = []
                        try:
                            score = float(r.question_score or 0)
                            categories[r.category].append(score)
                        except (ValueError, TypeError):
                            pass
                    
                    # Analyze gaps (low scores) and strengths (high scores)
                    gaps = []
                    strengths = []
                    
                    for cat, scores in categories.items():
                        cat_avg = sum(scores) / len(scores) if scores else 0
                        if cat_avg < 50: # Assuming 0-100 scale based on data
                            gaps.append(f"{cat} ({cat_avg:.1f}%)")
                        elif cat_avg > 80:
                            strengths.append(f"{cat} ({cat_avg:.1f}%)")
                            
                    # Construct rich summary
                    gap_text = ", ".join(gaps) if gaps else "None identified"
                    strength_text = ", ".join(strengths) if strengths else "None identified"
                    
                    content = f"""
Disease: {disease_name}
Country: {country}
Readiness Score: {avg_score:.1f}%
Readiness Type: {disease_name} preparedness assessment
Gaps: {gap_text}
Strengths: {strength_text}
Description: Comprehensive readiness assessment for {disease_name} in {country}. 
Based on {records.count()} indicators. 
Key gaps identified in: {gap_text}.
Key strengths identified in: {strength_text}.
"""
                    
                    doc_id = self.generate_doc_id("readiness", disease_name, country)
                    
                    success = self.rag.add_document(
                        collection="readiness",
                        doc_id=doc_id,
                        content=content.strip(),
                        metadata={
                            "source": f"{disease_name} - {country}",
                            "disease": disease_name,
                            "country": country,
                            "score": avg_score
                        }
                    )
                    
                    if success:
                        count += 1
                        
                except Exception as e:  # noqa: BLE001 — per-(country, disease) indexer loop: one bad combo must not abort the rest
                    logger.warning("Error indexing %s for %s: %s", disease_name, country, e)
                    continue
        
        self.indexed_count["readiness"] = count
        return count
    
    def index_glossary(self) -> int:
        """Index WHO terminology glossary."""
        from utils.constants import CAPACITIES
        
        count = 0
        
        # Define glossary terms
        glossary_terms = [
            # Severity levels
            ("Low Severity", "Low severity indicates minimal risk. The hazard is present but unlikely to cause significant impact."),
            ("Moderate Severity", "Moderate severity indicates some risk. The hazard may cause limited impact requiring basic response."),
            ("High Severity", "High severity indicates significant risk. The hazard is likely to cause substantial impact requiring coordinated response."),
            ("Very High Severity", "Very High severity indicates critical risk. The hazard presents immediate danger requiring emergency response measures."),
            
            # Programs
            ("STAR", "Seasonal Tool for Analysis of Risks. STAR provides seasonal risk assessments for health hazards across African countries."),
            ("IHR", "International Health Regulations. IHR is a legally binding framework for preventing and responding to public health emergencies."),
            ("e-SPAR", "Electronic State Party Self-Assessment Annual Reporting tool. e-SPAR measures country capacities under IHR."),
            ("CHW", "Community Health Workers. CHWs are frontline health workers providing basic health services in communities."),
            
            # Metrics
            ("CHW per 10k", "Community Health Workers per 10,000 population. A key indicator of health workforce density."),
            ("Capacity Score", "A score from 1-5 measuring a country's capability in a specific IHR core capacity area."),
        ]
        
        # Add capacity definitions
        for code, name in CAPACITIES.items():
            glossary_terms.append((
                f"Capacity {code}",
                f"{name}. This is one of the core capacity areas assessed under the IHR framework."
            ))
        
        for term, definition in glossary_terms:
            content = f"""
Term: {term}
Definition: {definition}
"""
            
            doc_id = self.generate_doc_id("glossary", term)
            
            success = self.rag.add_document(
                collection="glossary",
                doc_id=doc_id,
                content=content.strip(),
                metadata={
                    "source": "WHO Glossary",
                    "term": term
                }
            )
            
            if success:
                count += 1
        
        self.indexed_count["glossary"] = count
        return count
    
    def _get_capacity_description(self, code: str) -> str:
        """Get a brief description for a capacity code."""
        descriptions = {
            "C.1": "enact and enforce legislation for health security",
            "C.2": "coordinate health emergency responses across sectors",
            "C.3": "finance and allocate resources for health security",
            "C.4": "conduct laboratory testing and diagnosis",
            "C.5": "conduct disease surveillance and early detection",
            "C.6": "train and deploy human resources for health",
            "C.7": "manage emergency response operations",
            "C.8": "provide essential health services during emergencies",
            "C.9": "implement infection prevention and control measures",
            "C.10": "communicate risks to the public effectively",
            "C.11": "manage health events at points of entry",
            "C.12": "respond to zoonotic diseases and events",
            "C.13": "ensure food safety during emergencies",
            "C.14": "respond to chemical emergencies",
            "C.15": "respond to radiation emergencies",
        }
        return descriptions.get(code, "meet health security requirements")
    
    def index_all(self) -> Dict[str, int]:
        """Index all data sources. Returns count per collection."""
        results = {}
        
        logger.info("Indexing STAR hazard data...")
        results["star"] = self.index_star_data()
        
        logger.info("Indexing e-SPAR capacity data...")
        results["espar"] = self.index_espar_data()
        
        logger.info("Indexing CHW data...")
        results["chw"] = self.index_chw_data()
        
        logger.info("Indexing Readiness data...")
        results["readiness"] = self.index_readiness_data()
        
        logger.info("Indexing WHO Glossary...")
        results["glossary"] = self.index_glossary()
        
        logger.info("Indexing complete! Total: %d documents", sum(results.values()))
        return results


# Function to run indexing
def run_indexing():
    """Run the document indexer."""
    indexer = DocumentIndexer()
    return indexer.index_all()
