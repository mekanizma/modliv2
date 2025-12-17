from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# API Keys
FAL_KEY = os.environ.get('FAL_KEY', '')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')

# CORS origins (production and development)
ALLOWED_ORIGINS = os.environ.get(
    'ALLOWED_ORIGINS',
    'https://modli.mekanizma.com,http://localhost:8081,http://localhost:19006'
).split(',')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class TryOnRequest(BaseModel):
    user_id: str
    user_image: str  # base64 encoded (data:image/jpeg;base64,...)
    clothing_image: str  # base64 encoded (data:image/jpeg;base64,...)
    clothing_category: str
    is_free_trial: bool = False  # True if using free trial credit

class TryOnResponse(BaseModel):
    success: bool
    result_image: Optional[str] = None
    error: Optional[str] = None

class WeatherRequest(BaseModel):
    latitude: float
    longitude: float
    language: str = "en"


# Routes
@api_router.get("/")
async def root():
    return {"message": "Modli API - Virtual Try-On Service"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


async def try_on_with_fal(user_image: str, clothing_image: str, http_client: httpx.AsyncClient) -> TryOnResponse:
    """Use fal.ai for all users"""
    try:
        if not FAL_KEY:
            raise Exception("FAL_KEY not configured")
        
        logger.info("Using fal.ai for try-on...")
        
        headers = {
            "Authorization": f"Key {FAL_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "person_image_url": user_image,
            "clothing_image_url": clothing_image,
            # Preservation settings - keep person and clothing as original as possible
            "preserve_pose": True,           # Keep body pose unchanged
            "preserve_face": True,           # Keep face unchanged
            "preserve_background": True,     # Keep background unchanged
            # Quality settings - optimized for speed/quality balance
            "num_images": 1,
            "num_inference_steps": 30,       # Balanced: 30 steps (was 50, too slow)
            "guidance_scale": 7.5,           # Higher = more faithful to inputs
            # Fidelity settings
            "clothing_fidelity": "high",     # Keep clothing details accurate
            "body_fidelity": "high"          # Keep body proportions accurate
        }
        
        response = await http_client.post(
            "https://fal.run/fal-ai/image-apps-v2/virtual-try-on",
            headers=headers,
            json=payload
        )
        
        logger.info(f"fal.ai response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            images = result.get("images", [])
            if images:
                image_url = images[0].get("url")
                if image_url:
                    img_response = await http_client.get(image_url)
                    if img_response.status_code == 200:
                        img_base64 = base64.b64encode(img_response.content).decode()
                        logger.info("Successfully generated try-on image via fal.ai!")
                        return TryOnResponse(
                            success=True,
                            result_image=f"data:image/jpeg;base64,{img_base64}"
                        )
            
            return TryOnResponse(success=False, error="No images returned from API")
        else:
            error_text = response.text[:200]
            logger.error(f"fal.ai error: {response.status_code} - {error_text}")
            return TryOnResponse(success=False, error=f"API error: {response.status_code} - {error_text}")
            
    except Exception as e:
        logger.error(f"fal.ai error: {str(e)}")
        return TryOnResponse(success=False, error=str(e))


@api_router.post("/try-on", response_model=TryOnResponse)
async def virtual_try_on(request: TryOnRequest):
    """
    Generate a virtual try-on image using fal.ai
    - All users (including free trial) use fal.ai for best quality
    - Generates 1 image per request
    """
    try:
        logger.info(f"Try-on request - user: {request.user_id}, category: {request.clothing_category}")
        
        async with httpx.AsyncClient(timeout=300.0) as http_client:
            # All users use fal.ai for consistent high quality
            return await try_on_with_fal(
                request.user_image,
                request.clothing_image,
                http_client
            )
            
    except httpx.TimeoutException:
        logger.error("Request timed out")
        return TryOnResponse(success=False, error="Request timed out. Please try again.")
    except Exception as e:
        logger.error(f"Try-on error: {str(e)}")
        return TryOnResponse(success=False, error=str(e))


@api_router.post("/weather")
async def get_weather(request: WeatherRequest):
    """Get weather data for a location"""
    try:
        if not OPENWEATHER_API_KEY:
            raise HTTPException(status_code=500, detail="Weather API not configured")
        
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(
                f"https://api.openweathermap.org/data/2.5/weather",
                params={
                    "lat": request.latitude,
                    "lon": request.longitude,
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric",
                    "lang": request.language
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "temp": round(data["main"]["temp"]),
                    "description": data["weather"][0]["description"],
                    "icon": data["weather"][0]["icon"],
                    "city": data["name"],
                    "is_cold": data["main"]["temp"] < 15,
                    "is_rainy": "rain" in data["weather"][0]["main"].lower()
                }
            else:
                raise HTTPException(status_code=response.status_code, detail="Weather API error")
                
    except Exception as e:
        logger.error(f"Weather error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,  # Configured from environment
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
