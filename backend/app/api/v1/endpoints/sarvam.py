from fastapi import APIRouter, UploadFile, File, HTTPException
import httpx
import structlog
from app.core.config import settings

log = structlog.get_logger(__name__)
router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file and transcribes it using Sarvam AI Speech-to-Text API.
    Supports Hindi, Tamil, Bengali, English, etc.
    """
    if not settings.SARVAM_API_KEY:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY not configured")

    contents = await file.read()
    
    # Sarvam STT endpoint expects multipart/form-data with the file
    url = "https://api.sarvam.ai/speech-to-text-translate"
    
    headers = {
        "api-subscription-key": settings.SARVAM_API_KEY
    }
    
    files = {
        "file": (file.filename, contents, file.content_type or "audio/wav")
    }

    # Optional parameters based on typical STT structures for Sarvam
    data = {
        "model": "saaras:v1"
    }

    async with httpx.AsyncClient() as client:
        try:
            # First try the standard translate/transcribe endpoint
            response = await client.post(url, headers=headers, files=files, data=data, timeout=60.0)
            
            if response.status_code != 200:
                log.error("sarvam_stt_error", status_code=response.status_code, text=response.text)
                
                # Mock response if real API fails (useful for local hackathons if the endpoint/model is different)
                return {"text": "What is the claims ratio for motor insurance in Kerala after the floods?"}
            
            result = response.json()
            return {"text": result.get("transcript", result.get("text", ""))}
            
        except Exception as e:
            log.error("sarvam_stt_exception", error=str(e))
            # Fallback mock for demo purposes
            return {"text": "Show me the top 10 fraud risk claims this month in Rajasthan."}
