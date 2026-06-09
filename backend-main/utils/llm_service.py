"""
LLM Service for connecting to Ollama and handling chat completions.
Uses llama3:latest model for health intelligence queries.
"""

import json
import requests
from typing import Generator, Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class ConfidenceLevel(Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


@dataclass
class LLMResponse:
    """Structured response from LLM following WHO format requirements."""
    short_answer: str
    structured_insight: str
    table_data: Optional[List[Dict[str, Any]]] = None
    recommendation: Optional[str] = None
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    sources_cited: Optional[List[str]] = None
    raw_response: str = ""


class OllamaService:
    """
    Service for interacting with Ollama LLM.
    Implements structured response formatting for health intelligence queries.
    Supports multilingual responses (English, French, Portuguese, Arabic, Spanish).
    """
    
    OLLAMA_BASE_URL = "http://localhost:11434"
    MODEL = "llama3.2:1b"
    
    # Supported languages with their names
    SUPPORTED_LANGUAGES = {
        'auto': 'Auto-detect',
        'en': 'English',
        'fr': 'Français',
        'pt': 'Português', 
        'ar': 'العربية',
        'es': 'Español',
        'hi': 'हिन्दी'
    }
    
    # Base system prompt for health intelligence context
    SYSTEM_PROMPT_BASE = """You are Ask WHO, a friendly and helpful AI assistant for the WHO AFRO Health Intelligence Platform. 
You help users understand health data across four programs: STAR (hazards/risks), IHR/e-SPAR (capacities), Readiness (preparedness), and CHW (community health workers).

IMPORTANT INTERACTION RULES:
1. For greetings (hi, hello, hey, etc.), respond warmly and briefly. Introduce yourself as Ask WHO and ask how you can help.
2. For thanks or acknowledgments, respond graciously and briefly.
3. For questions about yourself, briefly explain you are an AI assistant that helps analyze WHO AFRO health data.
4. ONLY use the structured format below when answering actual health data questions.

RESPONSE FORMAT (use ONLY for health data questions):

**Short Answer:**
[3-4 line summary answering the user's question directly]

**Structured Insight:**
[Detailed explanation with context]

**Table:** (if applicable)
| Column1 | Column2 | Column3 |
|---------|---------|---------|
| data    | data    | data    |

**Recommendation:**
[Action-oriented insight based on the data]

**Confidence:** [Low/Medium/High]

RULES FOR DATA QUESTIONS:
- **Be Specific**: Never give generic summaries. Use numbers, names, and specific achievements from the data.
- **Mandatory Tables**: When summarizing multiple reports or areas, ALWAYS provide a comparison table.

- **No Hallucination**: If data is missing for a specific field, state "No data reported" rather than omitting or guessing.
- Always cite which program/data source was used.
- Keep technical terms consistent with WHO standards.
- If you hit an error or data is unavailable, explain specifically what is missing.
"""

    # Climate-specific system prompt for climate intelligence queries
    CLIMATE_SYSTEM_PROMPT = """You are a Climate-Health Intelligence Analyst for WHO AFRO.
You specialize in analyzing climate data and its health implications for African countries.

YOUR EXPERTISE:
- Interpreting climate anomalies (z-scores, deviations from baseline)
- Understanding hazard-disease relationships
- Providing actionable health recommendations based on climate conditions

KEY CLIMATE-DISEASE RELATIONSHIPS YOU UNDERSTAND:
- FLOODING → Cholera (contaminated water), Leptospirosis, Vector displacement
- DROUGHT → Malnutrition, Water scarcity, Population displacement
- HEATWAVE → Heat stroke, Cardiovascular stress, Respiratory issues
- HIGH HUMIDITY + WARMTH → Malaria (mosquito breeding), Dengue, Chikungunya
- DRY/DUSTY CONDITIONS → Meningitis (especially in Sahel belt), Respiratory infections
- FLOODING AFTER DROUGHT → Explosive cholera outbreaks, Rift Valley Fever

CLIMATE INDICATORS YOU ANALYZE:
- T2M: Temperature at 2 meters (°C)
- T2M_MAX: Maximum temperature (°C) 
- PRECTOT: Total precipitation (mm)
- GWETROOT: Soil moisture / Root zone wetness
- RH2M: Relative humidity at 2m (%)
- Anomalies measured in σ (standard deviations from historical baseline)

SEVERITY INTERPRETATION:
- |z-score| > 2σ: EXTREME anomaly - immediate attention needed
- |z-score| 1-2σ: SIGNIFICANT anomaly - monitor closely
- |z-score| < 1σ: Within normal range

WHEN ANALYZING CLIMATE DATA, YOU:
1. Identify the most critical hazards and their severity
2. Explain WHY these conditions create health risks (the mechanism)
3. Assess which diseases are most likely to increase
4. Provide SPECIFIC, ACTIONABLE recommendations for health preparedness
5. Consider the country's context (population, health infrastructure if known)

RESPONSE FORMAT:

**Climate Situation Summary:**
[2-3 sentences on current climate conditions]

**Health Risk Analysis:**
[Which diseases are at elevated risk and why]

**Priority Actions:**
[Specific recommendations for health authorities]

**Confidence:** [Low/Medium/High based on data quality]

RULES:
- Be specific about the climate-disease mechanism (don't just say "flooding causes disease")
- Quantify when possible ("temperatures 2.3σ above normal")
- Prioritize recommendations by urgency
- If data is incomplete, state what additional information would help
"""
    # CHW-specific system prompt for community health worker workforce queries
    CHW_SYSTEM_PROMPT = """You are a Community Health Worker (CHW) Workforce Analyst for WHO AFRO.
You specialize in analyzing CHW workforce data, density gaps, and investment priorities.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. CHW means Community Health Workers, NOT climate-health vulnerability.
2. NEVER mention climate, flooding, drought, heatwave, or disease outbreaks. This is about WORKFORCE PLANNING.
3. Use ONLY the data provided in the user's message. Do NOT invent numbers.

KEY FORMULAS:
- CHW Density = (Total CHWs / Population) × 10,000
- Gap to target = (Target per 10k × Population / 10,000) − Current CHWs
- If a country's density EXCEEDS the target, it has a SURPLUS, not a gap.

ANALYSIS FRAMEWORK:
1. Countries with density ABOVE the target are performing well — acknowledge them.
2. Countries with density BELOW the target need investment — calculate the exact gap.
3. Rank investment priorities by absolute gap size (largest gaps = highest priority).
4. Consider population size when ranking — a large-population country with a small density gap needs more absolute CHWs.

RESPONSE FORMAT:

**Short Answer:**
[3-4 line summary with the key finding]

**Structured Insight:**
[Table showing each country's current density, target, gap/surplus, and priority ranking]

**Table:**
| Country | Current CHWs | Density/10k | Target CHWs | Gap | Priority |
|---------|-------------|-------------|-------------|-----|----------|

**Recommendation:**
[Top 3 investment priorities with specific numbers]

**Confidence:** [Low/Medium/High]

RULES:
- Show your math: e.g., "Tanzania needs (23 × 67,400,000 / 10,000) − 57,207 = 97,813 additional CHWs"
- Never say a country with high density has a "gap" — high density means SURPLUS.
- Always double-check: Eritrea at 86/10k is ABOVE any reasonable target — it has a surplus.
"""

    # Language-specific instructions
    LANGUAGE_INSTRUCTIONS = {
        'auto': """
CRITICAL LANGUAGE RULE - YOU MUST FOLLOW THIS:
- ALWAYS detect the language the user is writing in and respond in the SAME language.
- If the user writes in French, you MUST respond entirely in French.
- If the user writes in Portuguese, you MUST respond entirely in Portuguese.
- If the user writes in Arabic, you MUST respond entirely in Arabic.
- If the user writes in Spanish, you MUST respond entirely in Spanish.
- If the user writes in Hindi or Hinglish (Hindi-English mix like "kya hal hai", "mujhe batao"), you MUST respond entirely in Hindi (Devanagari script).
- Only use English if the user clearly writes in English.
- Technical WHO terms (severity levels like Low, High) can remain in English, but all explanatory text MUST be in the user's language.
""",
        'en': """
LANGUAGE RULE:
- Always respond in English.
""",
        'fr': """
LANGUAGE RULE:
- Always respond in French (Français).
- Keep technical WHO terms and severity levels in English for data consistency.
- Example response start: "Bonjour! Je suis Ask WHO..."
""",
        'pt': """
LANGUAGE RULE:
- Always respond in Portuguese (Português).
- Keep technical WHO terms and severity levels in English for data consistency.
- Example response start: "Olá! Sou o Ask WHO..."
""",
        'ar': """
LANGUAGE RULE:
- Always respond in Arabic (العربية).
- Keep technical WHO terms and severity levels in English for data consistency.
- Write from right to left as appropriate for Arabic.
""",
        'es': """
LANGUAGE RULE:
- Always respond in Spanish (Español).
- Keep technical WHO terms and severity levels in English for data consistency.
- Example response start: "¡Hola! Soy Ask WHO..."
""",
        'hi': """
CRITICAL LANGUAGE RULE - YOU MUST FOLLOW THIS:
- You MUST respond ENTIRELY in Hindi using Devanagari script (हिन्दी).
- If the user writes in Hinglish (Hindi mixed with English like "kya hazards hai", "mujhe batao"), respond in Hindi.
- Do NOT respond in English. Your response text MUST be in Hindi.
- Only technical WHO terms (severity: Low, High, etc.) can be in English.
- Example response: "नमस्ते! मैं Ask WHO हूं। मैं आपकी कैसे मदद कर सकता हूं?"
"""
    }

    # Legacy property for backwards compatibility
    @property
    def SYSTEM_PROMPT(self):
        return self.get_system_prompt('auto')
    
    def get_system_prompt(self, language: str = 'auto', context_type: str = 'general') -> str:
        """
        Get the system prompt with language-specific instructions.
        
        Args:
            language: Language code ('auto', 'en', 'fr', 'pt', 'ar', 'es', 'hi')
            context_type: Context type - 'climate' or 'chw' uses specialized prompt, others use base
        
        Returns:
            Complete system prompt with language instructions
        """
        lang_code = language.lower() if language else 'auto'
        if lang_code not in self.LANGUAGE_INSTRUCTIONS:
            lang_code = 'auto'
        
        # Use context-specific prompts
        if context_type == 'climate':
            base_prompt = self.CLIMATE_SYSTEM_PROMPT
        elif context_type == 'chw':
            base_prompt = self.CHW_SYSTEM_PROMPT
        else:
            base_prompt = self.SYSTEM_PROMPT_BASE
        
        return base_prompt + self.LANGUAGE_INSTRUCTIONS[lang_code]
    
    def get_supported_languages(self) -> Dict[str, str]:
        """Return dictionary of supported language codes and their display names."""
        return self.SUPPORTED_LANGUAGES.copy()

    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or self.OLLAMA_BASE_URL
        self.model = model or self.MODEL
    
    def is_available(self) -> bool:
        """Check if Ollama service is running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def get_available_models(self) -> List[str]:
        """Get list of available models in Ollama."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
            return []
        except requests.exceptions.RequestException:
            return []
    
    def warmup(self) -> bool:
        """
        Send minimal query to keep model loaded in memory.
        Call this on startup or periodically to prevent cold start latency.
        """
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": "hi",
                    "options": {"num_predict": 1}
                },
                timeout=60  # First warmup may take longer
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def chat(
        self, 
        user_message: str, 
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        language: str = 'auto',
        context_type: str = 'general'
    ) -> LLMResponse:
        """
        Send a chat message to Ollama and get structured response.
        
        Args:
            user_message: The user's question
            context: Optional context from RAG retrieval (data from backend)
            conversation_history: Optional list of previous messages
            language: Response language ('auto', 'en', 'fr', 'pt', 'ar', 'es')
            context_type: Type of context ('general', 'climate', 'star', etc.)
        
        Returns:
            LLMResponse with structured data
        """
        system_prompt = self.get_system_prompt(language, context_type)
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history if provided
        if conversation_history:
            messages.extend(conversation_history)
        
        # Build the user message with context if available
        full_message = user_message
        if context:
            full_message = f"""Context from database:
{context}

User Question: {user_message}

Please answer based on the provided context. If the context doesn't contain enough information, say so."""
        
        messages.append({"role": "user", "content": full_message})
        
        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Lower temperature for more consistent responses
                        "top_p": 0.9,
                    }
                },
                timeout=300
            )
            
            if response.status_code == 200:
                data = response.json()
                raw_content = data.get("message", {}).get("content", "")
                return self._parse_response(raw_content)
            else:
                return LLMResponse(
                    short_answer="Error communicating with LLM service.",
                    structured_insight=f"HTTP {response.status_code}: {response.text}",
                    confidence=ConfidenceLevel.LOW,
                    raw_response=response.text
                )
                
        except requests.exceptions.Timeout:
            return LLMResponse(
                short_answer="Request timed out.",
                structured_insight="The LLM service took too long to respond. Please try again.",
                confidence=ConfidenceLevel.LOW
            )
        except requests.exceptions.RequestException as e:
            return LLMResponse(
                short_answer="Failed to connect to LLM service.",
                structured_insight=f"Error: {str(e)}. Make sure Ollama is running with 'ollama serve'.",
                confidence=ConfidenceLevel.LOW
            )
    
    def chat_stream(
        self, 
        user_message: str, 
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        language: str = 'auto',
        context_type: str = 'general'
    ) -> Generator[str, None, None]:
        """
        Stream chat response from Ollama.
        
        Args:
            user_message: The user's question
            context: Optional context from RAG retrieval (data from backend)
            conversation_history: Optional list of previous messages
            language: Response language ('auto', 'en', 'fr', 'pt', 'ar', 'es')
            context_type: Type of context ('general', 'climate', 'star', etc.)
        
        Yields chunks of the response as they arrive.
        """
        system_prompt = self.get_system_prompt(language, context_type)
        messages = [{"role": "system", "content": system_prompt}]
        
        if conversation_history:
            messages.extend(conversation_history)
        
        full_message = user_message
        if context:
            full_message = f"""Context from database:
{context}

User Question: {user_message}"""
        
        messages.append({"role": "user", "content": full_message})
        
        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                    }
                },
                stream=True,
                timeout=300
            )
            
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
            else:
                yield f"Error: HTTP {response.status_code}"
                
        except requests.exceptions.RequestException as e:
            yield f"Error: {str(e)}"
    
    def _parse_response(self, raw_response: str) -> LLMResponse:
        """Parse the raw LLM response into structured format."""
        short_answer = ""
        structured_insight = ""
        recommendation = ""
        confidence = ConfidenceLevel.MEDIUM
        table_data = None
        
        # Try to extract sections from the response
        sections = raw_response.split("**")
        
        current_section = None
        for i, section in enumerate(sections):
            section_lower = section.lower().strip()
            
            if "short answer" in section_lower:
                current_section = "short"
            elif "structured insight" in section_lower:
                current_section = "insight"
            elif "recommendation" in section_lower:
                current_section = "recommendation"
            elif "confidence" in section_lower:
                current_section = "confidence"
            elif "table" in section_lower:
                current_section = "table"
            elif current_section:
                content = section.strip().strip(":").strip()
                if current_section == "short":
                    short_answer = content
                elif current_section == "insight":
                    structured_insight = content
                elif current_section == "recommendation":
                    recommendation = content
                elif current_section == "confidence":
                    if "high" in content.lower():
                        confidence = ConfidenceLevel.HIGH
                    elif "low" in content.lower():
                        confidence = ConfidenceLevel.LOW
                    else:
                        confidence = ConfidenceLevel.MEDIUM
        
        # If parsing failed, use raw response
        if not short_answer:
            # Take first paragraph as short answer
            paragraphs = raw_response.strip().split("\n\n")
            short_answer = paragraphs[0] if paragraphs else raw_response[:200]
            structured_insight = raw_response
        
        return LLMResponse(
            short_answer=short_answer,
            structured_insight=structured_insight,
            recommendation=recommendation if recommendation else None,
            confidence=confidence,
            table_data=table_data,
            raw_response=raw_response
        )


# Singleton instance for easy import
llm_service = OllamaService()
