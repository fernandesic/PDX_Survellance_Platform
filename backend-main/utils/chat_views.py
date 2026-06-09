"""
Chat API Views for LLM-powered health intelligence queries.
Provides endpoints for chatbot functionality with RAG support.
"""

import logging
import time

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.http import StreamingHttpResponse
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from utils.permissions import IsNotUserRole

from utils.llm_service import llm_service, LLMResponse
from utils.rag_service import rag_service
from utils.fast_rag_service import fast_rag_service
from utils.index import custom_response

logger = logging.getLogger(__name__)


class ChatQueryView(APIView):
    """
    Main chat endpoint for LLM queries.
    Accepts user questions and returns structured responses.
    """
    permission_classes = [IsAuthenticated, IsNotUserRole]
    
    @swagger_auto_schema(
        operation_summary="Chat with Health Intelligence AI",
        operation_description="Send a question to the AI assistant and receive a structured response.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['message'],
            properties={
                'message': openapi.Schema(
                    type=openapi.TYPE_STRING, 
                    description='User question or query'
                ),
                'context_type': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Optional: Program context (star, espar, readiness, chw, climate)',
                    enum=['star', 'espar', 'readiness', 'chw', 'climate', 'general']
                ),
                'country': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Optional: Country filter for context'
                ),
                'conversation_history': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            'role': openapi.Schema(type=openapi.TYPE_STRING),
                            'content': openapi.Schema(type=openapi.TYPE_STRING)
                        }
                    ),
                    description='Optional: Previous conversation messages for context'
                ),
                'language': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Optional: Response language (auto=detect from input, en, fr, pt, ar, es)',
                    enum=['auto', 'en', 'fr', 'pt', 'ar', 'es'],
                    default='auto'
                ),
            }
        ),
        responses={
            200: openapi.Response(
                description="Successful response",
                examples={
                    "application/json": {
                        "status": "OK",
                        "message": "Response generated",
                        "data": {
                            "short_answer": "Country X faces two high-risk hazards...",
                            "structured_insight": "Detailed analysis...",
                            "recommendation": "Prioritize water safety...",
                            "confidence": "High",
                            "raw_response": "Full response text..."
                        }
                    }
                }
            ),
            503: openapi.Response(description="LLM service unavailable")
        }
    )
    def post(self, request):
        start_time = time.time()
        logger.info(f"[CHAT] Request received")
        
        user_message = request.data.get('message', '').strip()
        context_type = request.data.get('context_type', 'general')
        country = request.data.get('country', None)
        conversation_history = request.data.get('conversation_history', [])
        language = request.data.get('language', 'auto')  # Language for response
        
        if not user_message:
            return custom_response(
                status="Error",
                message="Message is required",
                data={},
                http_status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if Ollama is available
        logger.info(f"[CHAT] Checking Ollama availability...")
        ollama_check_start = time.time()
        if not llm_service.is_available():
            return custom_response(
                status="Error",
                message="LLM service is not available. Please ensure Ollama is running.",
                data={"hint": "Run 'ollama serve' to start the service"},
                http_status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        logger.info(f"[CHAT] Ollama available (took {time.time() - ollama_check_start:.2f}s)")
        
        # Extract country from message if not provided
        if not country:
            country = self._extract_country(user_message)
            logger.info(f"[CHAT] Extracted country from message: {country}")
        
        # Build context from database based on context_type
        logger.info(f"[CHAT] Building context for type={context_type}, country={country}")
        context_start = time.time()
        context, metadata = self._build_context(context_type, country, conversation_history)
        logger.info(f"[CHAT] Context built (took {time.time() - context_start:.2f}s). Metadata: {metadata}")
        
        # Get response from LLM
        logger.info(f"[CHAT] Calling LLM with message: {user_message[:50]}...")
        llm_start = time.time()
        response: LLMResponse = llm_service.chat(
            user_message=user_message,
            context=context,
            conversation_history=conversation_history,
            language=language,
            context_type=context_type
        )
        logger.info(f"[CHAT] LLM response received (took {time.time() - llm_start:.2f}s)")
        
        total_time = time.time() - start_time
        logger.info(f"[CHAT] Request completed in {total_time:.2f}s")
        
        return custom_response(
            status="OK",
            message="Response generated",
            data={
                "short_answer": response.short_answer,
                "structured_insight": response.structured_insight,
                "recommendation": response.recommendation,
                "confidence": response.confidence.value,
                "table_data": response.table_data,
                "sources_cited": response.sources_cited,
                "raw_response": response.raw_response,
                "rag_used": metadata.get("rag_used", False),
                "data_sources": metadata.get("sources", [])
            }
        )
    
    def _build_context(self, context_type: str, country: str = None, conversation_history: list = None, use_rag: bool = True) -> tuple:
        """
        Build context string for LLM from database.
        Uses fast RAG when indexed, otherwise falls back to direct queries.
        Returns: (context_string, metadata_dict)
        """
        rag_used = False
        data_sources = []
        
        # Try fast RAG first if indexed
        if use_rag and fast_rag_service.is_indexed():
            collections = None if context_type == 'general' else [context_type]
            query = f"{country} health data" if country else "health overview"
            rag_context = fast_rag_service.build_context(query, collections, max_docs=5)
            if rag_context:
                logger.info(f"[CHAT] Using RAG context ({fast_rag_service.get_collection_stats()})")
                rag_used = True
                # Determine sources based on context content or collection
                if context_type != 'general':
                    data_sources.append(context_type.upper())
                else:
                    # simplistic source detection from text content
                    if "STAR" in rag_context: data_sources.append("STAR")
                    if "IHR" in rag_context or "SPAR" in rag_context: data_sources.append("ESPAR")
                    if "CHW" in rag_context: data_sources.append("CHW")
                    if "Readiness" in rag_context: data_sources.append("READINESS")
                
                return rag_context, {"rag_used": True, "sources": list(set(data_sources))}
        
        # Fallback to direct database queries
        context_parts = []
        
        # Add relevant glossary definitions
        glossary = self._get_glossary(context_type)
        if glossary:
            context_parts.append(f"DEFINITIONS:\n{glossary}\n")
        
        try:
            if context_type == 'star' or context_type == 'general':
                from stardata.models import StarData
                from django.db.models.functions import Trim
                from utils.severity_utils import normalize_severity
                
                qs = StarData.objects.annotate(
                    cleaned_country=Trim('country'),
                    cleaned_hazard=Trim('hazard'),
                    cleaned_severity=Trim('severity'),
                    cleaned_type=Trim('main_type_of_hazard'),
                )
                
                if country:
                    qs = qs.filter(cleaned_country__icontains=country)
                
                # Get summary statistics
                total_hazards = qs.count()
                high_risk = qs.filter(cleaned_severity__in=['High', 'Very High', 'Elevada', 'Muito elevada']).count()
                
                hazards = qs.values('cleaned_country', 'cleaned_hazard', 'cleaned_severity', 'cleaned_type')[:15]
                
                if hazards:
                    context_parts.append("STAR HAZARD DATA:")
                    context_parts.append(f"Total hazards: {total_hazards}, High/Very High risk: {high_risk}")
                    data_sources.append("STAR")
                    for h in hazards:
                        severity = normalize_severity(h['cleaned_severity'])
                        context_parts.append(f"- {h['cleaned_country']}: {h['cleaned_hazard']} ({h['cleaned_type']}) - Severity: {severity}")
            
            if context_type == 'espar' or context_type == 'general':
                from espar.models import Espar, Indicator
                from django.db.models import Max
                
                espars = Espar.objects.select_related('sheet').all()
                if country:
                    espars = espars.filter(states__icontains=country)
                
                espars = espars[:10]
                if espars.exists():
                    context_parts.append("\nIHR/e-SPAR CAPACITY DATA:")
                    for e in espars:
                        indicators = Indicator.objects.filter(espar=e)
                        if indicators.exists():
                            scores = [ind.scaled_score() for ind in indicators[:15]]
                            avg_score = sum(scores) / len(scores) if scores else 0
                            min_score = min(scores) if scores else 0
                            max_score = max(scores) if scores else 0
                            context_parts.append(f"- {e.states} ({e.sheet.name if e.sheet else 'N/A'}): Avg capacity: {avg_score:.1f}/5 (range: {min_score:.1f}-{max_score:.1f})")
                    if espars.exists():
                        data_sources.append("ESPAR")
            
            if context_type == 'chw' or context_type == 'general':
                from chwfolder.models import Country as CHWCountry, Region as CHWRegion, WorkerType
                from django.db.models import Sum
                
                countries = CHWCountry.objects.all()
                if country:
                    countries = countries.filter(country__icontains=country)
                
                # Get totals
                totals = CHWCountry.objects.aggregate(
                    total_chws=Sum('total_chws'),
                )
                
                countries_list = countries[:15]
                if countries_list.exists():
                    total_chws = totals['total_chws'] or 0
                    context_parts.append("\nCHW (COMMUNITY HEALTH WORKER) DATA:")
                    context_parts.append(f"Total CHWs across {CHWCountry.objects.count()} countries: {total_chws:,}")
                    context_parts.append(f"Total regions: {CHWRegion.objects.count()}")
                    data_sources.append("CHW")
                    
                    for c in countries_list:
                        line = f"- {c.country}: {c.total_chws:,} CHWs"
                        if c.total_regions:
                            line += f", {c.total_regions} regions"
                        if c.total_districts:
                            line += f", {c.total_districts} districts"
                        if c.total_facilities:
                            line += f", {c.total_facilities} facilities"
                        if c.chws_per_10000 and c.chws_per_10000 > 0:
                            line += f" ({c.chws_per_10000:.1f} per 10k)"
                        context_parts.append(line)
                        
                        # Add top regions for country-specific queries
                        if country:
                            top_regions = CHWRegion.objects.filter(country=c).order_by('-total_chws')[:5]
                            for r in top_regions:
                                context_parts.append(f"  • {r.region_name}: {r.total_chws:,} CHWs")
                            
                            # Add worker type diversity
                            worker_types = (
                                WorkerType.objects.filter(country=c)
                                .values('worker_type')
                                .annotate(total=Sum('count'))
                                .order_by('-total')
                            )
                            if worker_types:
                                types_str = ", ".join([f"{wt['worker_type']}={wt['total']:,}" for wt in worker_types[:8]])
                                context_parts.append(f"  Worker types: {types_str}")
            
            if context_type == 'readiness' or context_type == 'general':
                context_parts.append("\nREADINESS DATA:")
                context_parts.append("Available assessments: ArboVirus, Cholera, Mpox, Marburg, Meningitis, Lassa Fever, Rift Valley Fever")
                context_parts.append("Note: Readiness scores indicate preparedness for specific health hazards")
                data_sources.append("READINESS")

            if context_type == 'preparedness':
                from readiness.models import WeeklyReport
                reports = WeeklyReport.objects.all().order_by('-created_on')[:20]

                if reports:
                    context_parts.append("\nWEEKLY PREPAREDNESS REPORTS DATA:")
                    context_parts.append(f"Total reports available: {reports.count()}")
                    data_sources.append("PREPAREDNESS")

                    for r in reports:
                        context_parts.append(f"\n--- Week: {r.week_range} ---")
                        for field_name, label in [
                            ('featured_achievement', 'Featured Achievement'),
                            ('key_figures', 'Key Figures'),
                            ('health_security_governance', 'Health Security Governance'),
                            ('health_security_financing', 'Health Security Financing'),
                            ('threats_risks_management', 'Threats & Risks Management'),
                            ('ihrme', 'IHMREF'),
                            ('ipc', 'IPC'),
                            ('readiness', 'Readiness'),
                            ('naphs', 'NAPHS'),
                            ('community_protection', 'Community Protection'),
                            ('workforce_training', 'Workforce & Training'),
                            ('pandemic_influenza', 'Pandemic Influenza'),
                            ('vaccines_research', 'Vaccines & Research'),
                            ('diseases_under_elimination', 'Diseases Under Elimination'),
                            ('innovative_projects', 'Innovative Projects'),
                        ]:
                            val = getattr(r, field_name, None)
                            if val and str(val).strip():
                                context_parts.append(f"  {label}: {val}")
                else:
                    context_parts.append("\nPREPAREDNESS DATA: No reports submitted yet.")
                    data_sources.append("PREPAREDNESS")

        except Exception as e:  # noqa: BLE001 — multi-source aggregation: one bad source must not break the prompt
            logger.error(f"[CHAT] Error building context: {e}")
            context_parts.append(f"\nNote: Some data could not be loaded: {str(e)}")
        
        return ("\n".join(context_parts), {"rag_used": False, "sources": list(set(data_sources))}) if context_parts else (None, {"rag_used": False, "sources": []})

    def _get_glossary(self, context_type: str) -> str:
        """Get relevant glossary definitions for context type."""
        glossary = {
            'star': """- STAR: Strategic Tool for Assessing Risks - WHO tool for analyzing health hazards
- Severity levels: Low, Moderate, High, Very High
- Hazard types include: Biological, Natural, Technological""",
            
            'espar': """- IHR: International Health Regulations - legally binding agreement for disease reporting
- e-SPAR: Electronic State Parties Annual Report - self-assessment tool for IHR capacities
- Capacity scores range from 1-5 (1=no capacity, 5=sustainable capacity)
- 15 capacity areas measured including surveillance, laboratory, response""",
            
            'chw': """- CHW: Community Health Worker - health workers based in communities
- CHWs provide health education, referral, case management, and preventive care
- CHW density often measured per 10,000 population""",
            
            'readiness': """- Readiness: Preparedness assessment for specific health hazards
- Assessments cover surveillance, laboratory, response, communication, coordination
- Question scores indicate level of preparedness (higher = more prepared)""",
            
            'preparedness': """- Preparedness Reports: Weekly submissions from team members reporting on health security activities
- Key areas: Readiness, NAPHS, Community Protection, Workforce Training, Pandemic Influenza, Vaccines & Research
- Additional tracking: Key Figures, Health Security Governance, Health Security Financing, Threats & Risks Management
- Reports include featured achievements and updates across health security domains
- Use this data to summarize trends, identify gaps, track progress, and highlight key achievements""",
            
            'climate': """- Climate Intelligence: Real-time and historical climate data analysis for health risk assessment
- Data sources: Open-Meteo (live weather), NASA POWER (historical with 5-day delay)
- Hazard types: Flood, Drought, Heatwave, Fire
- Severity levels: LOW, MEDIUM, HIGH - based on climate anomalies (z-scores from historical baseline)
- Disease risks: Climate conditions can increase risk of cholera (flooding), malaria (temperature/humidity), meningitis (dry/dusty conditions), malnutrition (drought)
- Anomalies: Deviations measured in standard deviations (σ) from historical normal
- Climate indicators: T2M (temperature at 2m), PRECTOT (precipitation), GWETROOT (soil moisture), RH2M (relative humidity)""",
            
            'general': """- WHO AFRO: World Health Organization African Regional Office
- STAR: Strategic Tool for Assessing Risks
- IHR/e-SPAR: International Health Regulations capacity assessment
- CHW: Community Health Worker
- Climate Intelligence: Climate data analysis for health risk assessment"""
        }
        
        return glossary.get(context_type, glossary['general'])
    
    def _extract_country(self, message: str) -> str:
        """Extract country name from user message."""
        from utils.afro_countries import AFRO_COUNTRIES
        
        message_lower = message.lower()
        
        # Check for each AFRO country in the message
        for country in AFRO_COUNTRIES:
            if country.lower() in message_lower:
                return country
        
        # Common variations
        country_aliases = {
            'drc': 'Democratic Republic of the Congo',
            'congo': 'Democratic Republic of the Congo',
            'ivory coast': "C�te d'Ivoire",
            'car': 'Central African Republic',
            'south africa': 'South Africa',
        }
        
        for alias, full_name in country_aliases.items():
            if alias in message_lower:
                return full_name
        
        return None
    
    def _is_conversational_message(self, message: str) -> bool:
        """
        Detect if a message is purely conversational (greeting, thanks, etc.)
        and doesn't require health data context.
        """
        message_lower = message.lower().strip()
        
        # Common greetings and conversational patterns
        greetings = [
            'hi', 'hello', 'hey', 'hola', 'bonjour', 'good morning', 'good afternoon', 
            'good evening', 'howdy', 'greetings', 'yo', 'sup', "what's up", 'whats up',
            'how are you', 'how r u', 'how do you do'
        ]
        
        thanks_phrases = [
            'thank', 'thanks', 'thx', 'appreciate', 'grateful', 'cheers'
        ]
        
        farewells = [
            'bye', 'goodbye', 'see you', 'take care', 'later', 'ciao', 'adios'
        ]
        
        acknowledgments = [
            'ok', 'okay', 'got it', 'understood', 'i see', 'alright', 'sure', 'yes', 'no',
            'cool', 'nice', 'great', 'awesome', 'perfect'
        ]
        
        about_you = [
            'who are you', 'what are you', 'what can you do', 'what do you do',
            'tell me about yourself', 'introduce yourself', 'your name', 'whats your name'
        ]
        
        # Check if message matches any conversational pattern
        # For very short messages (1-2 words), check if it's a greeting
        words = message_lower.split()
        if len(words) <= 3:
            for greeting in greetings:
                if message_lower == greeting or message_lower.startswith(greeting + ' ') or message_lower.endswith(' ' + greeting):
                    return True
            for ack in acknowledgments:
                if message_lower == ack:
                    return True
        
        # Check for thanks and farewells
        for phrase in thanks_phrases + farewells:
            if phrase in message_lower:
                return True
        
        # Check for "about you" questions
        for phrase in about_you:
            if phrase in message_lower:
                return True
        
        return False


from django.db import transaction
from django.utils.decorators import method_decorator


@method_decorator(transaction.non_atomic_requests, name='dispatch')
class ChatStreamView(APIView):
    """
    Streaming chat endpoint for real-time responses.

    Opted out of ATOMIC_REQUESTS because StreamingHttpResponse holds
    the connection open for the entire LLM generation.  All DB reads
    happen before the stream starts, so transactional isolation is not
    needed for the streaming phase.
    """
    permission_classes = [IsAuthenticated, IsNotUserRole]

    def post(self, request):
        user_message = request.data.get('message', '').strip()
        context_type = request.data.get('context_type', 'general')
        country = request.data.get('country', None)
        conversation_history = request.data.get('conversation_history', [])
        language = request.data.get('language', 'auto')  # Language for response
        
        if not user_message:
            return Response(
                {"error": "Message is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not llm_service.is_available():
            return Response(
                {"error": "LLM service unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Extract country from message if not provided
        if not country:
            country = self._extract_country(user_message)
        
        # Check if this is a conversational message (greeting, thanks, etc.)
        # If so, skip context building to get a natural response
        is_conversational = self._is_conversational_message(user_message)
        
        if is_conversational:
            context = None
            metadata = {"rag_used": False, "sources": [], "conversational": True}
            logger.info(f"[CHAT] Conversational message detected, skipping context: {user_message[:30]}")
        else:
            # Build context from database (same logic as ChatQueryView)
            context, metadata = self._build_context(context_type, country, conversation_history)
        
        def generate():
            import json
            
            # Send metadata as first event
            metadata_event = {
                "type": "metadata",
                "rag_used": metadata.get("rag_used", False),
                "data_sources": metadata.get("sources", [])
            }
            yield f"data: {json.dumps(metadata_event)}\n\n"
            
            try:
                for chunk in llm_service.chat_stream(user_message, context=context, conversation_history=conversation_history, language=language, context_type=context_type):
                    # JSON encode to properly handle newlines and special chars
                    encoded = json.dumps(chunk)
                    yield f"data: {encoded}\n\n"
            except Exception as e:  # noqa: BLE001 — SSE stream wrapper: any failure must be surfaced to the client frame
                logger.error(f"[CHAT] Error in stream generation: {e}")
                error_msg = json.dumps(f"Error generating response: {str(e)}")
                yield f"data: {error_msg}\n\n"
                
            yield "data: [DONE]\n\n"
        
        return StreamingHttpResponse(
            generate(),
            content_type='text/event-stream'
        )
    
    def _build_context(self, context_type: str, country: str = None, conversation_history: list = None) -> tuple:
        """
        Build context using ChatQueryView logic to ensure consistency and RAG support.
        Returns: (context_string, metadata_dict)
        """
        view = ChatQueryView()
        return view._build_context(context_type, country, conversation_history)
    
    def _extract_country(self, message: str) -> str:
        """Extract country name from user message."""
        from utils.afro_countries import AFRO_COUNTRIES

        message_lower = message.lower()
        
        for country in AFRO_COUNTRIES:
            if country.lower() in message_lower:
                return country
        
        country_aliases = {
            'drc': 'Democratic Republic of the Congo',
            'congo': 'Democratic Republic of the Congo',
            'ivory coast': "C�te d'Ivoire",
            'car': 'Central African Republic',
            'south africa': 'South Africa',
        }
        
        for alias, full_name in country_aliases.items():
            if alias in message_lower:
                return full_name
        
        return None
    
    def _is_conversational_message(self, message: str) -> bool:
        """Delegate to ChatQueryView for consistency."""
        view = ChatQueryView()
        return view._is_conversational_message(message)


class ChatHealthView(APIView):
    """
    Health check endpoint for LLM service.
    """
    permission_classes = []  # Public endpoint
    
    @swagger_auto_schema(
        operation_summary="Check LLM Service Health",
        operation_description="Returns the status of the Ollama LLM service.",
        responses={
            200: openapi.Response(
                description="Service status",
                examples={
                    "application/json": {
                        "status": "OK",
                        "ollama_available": True,
                        "model": "llama3:8b",
                        "available_models": ["llama3:8b", "llama3:70b"]
                    }
                }
            )
        }
    )
    def get(self, request):
        is_available = llm_service.is_available()
        models = llm_service.get_available_models() if is_available else []
        
        return Response({
            "status": "OK" if is_available else "Unavailable",
            "ollama_available": is_available,
            "model": llm_service.model,
            "available_models": models,
        })


class ChatWarmupView(APIView):
    """
    Warmup endpoint to keep LLM model loaded in memory.
    Call this on app startup or periodically to prevent cold start latency.
    """
    permission_classes = []  # Public endpoint
    
    @swagger_auto_schema(
        operation_summary="Warmup LLM Model",
        operation_description="Sends a minimal query to keep the model loaded in memory.",
        responses={
            200: openapi.Response(
                description="Warmup status",
                examples={
                    "application/json": {
                        "status": "OK",
                        "message": "Model warmed up successfully"
                    }
                }
            )
        }
    )
    def post(self, request):
        logger.info("[CHAT] Warmup request received")
        start_time = time.time()
        
        # Warmup LLM
        llm_success = llm_service.warmup()
        
        # Index RAG if not already done
        rag_stats = {}
        if not fast_rag_service.is_indexed():
            logger.info("[CHAT] Indexing RAG...")
            try:
                rag_stats = fast_rag_service.index_from_database(limit_per_collection=100)
                logger.info(f"[CHAT] RAG indexed: {rag_stats}")
            except Exception as e:  # noqa: BLE001 — best-effort RAG warmup: chat must still run if indexing fails
                logger.error(f"[CHAT] RAG indexing failed: {e}")
        else:
            rag_stats = fast_rag_service.get_collection_stats()
        
        elapsed = time.time() - start_time
        logger.info(f"[CHAT] Warmup completed in {elapsed:.2f}s, llm_success={llm_success}")
        
        if llm_success:
            return Response({
                "status": "OK",
                "message": "Model warmed up successfully",
                "time_seconds": round(elapsed, 2),
                "rag_indexed": fast_rag_service.is_indexed(),
                "rag_stats": rag_stats
            })
        else:
            return Response({
                "status": "Failed",
                "message": "Could not warm up model. Is Ollama running?",
                "rag_indexed": fast_rag_service.is_indexed(),
                "rag_stats": rag_stats
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
