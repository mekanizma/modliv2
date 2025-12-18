from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
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
from PIL import Image
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# API Keys
FAL_KEY = os.environ.get('FAL_KEY', '')
OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

# CORS - Allow all origins for mobile app compatibility
# Mobile apps don't send Origin headers, so we allow all
ALLOWED_ORIGINS = ["*"]

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


# Utility Functions
def create_thumbnail(image_data: bytes, size: tuple = (300, 300)) -> bytes:
    """Create a thumbnail from image data"""
    try:
        image = Image.open(io.BytesIO(image_data))
        image.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=85, optimize=True)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Error creating thumbnail: {str(e)}")
        raise


def base64_to_bytes(base64_string: str) -> bytes:
    """Convert base64 string to bytes"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    return base64.b64decode(base64_string)


def bytes_to_base64(image_bytes: bytes) -> str:
    """Convert bytes to base64 string"""
    return f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode('utf-8')}"


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

class ImageUploadResponse(BaseModel):
    success: bool
    full_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    error: Optional[str] = None

class ImageUploadRequest(BaseModel):
    image_base64: str
    bucket: str = "wardrobe"  # wardrobe or profiles
    user_id: str
    filename: Optional[str] = None


class WardrobeItemCreate(BaseModel):
    user_id: str
    name: str
    image_url: str
    thumbnail_url: str
    category: str
    season: Optional[str] = None
    color: Optional[str] = None


class TryOnResultCreate(BaseModel):
    user_id: str
    wardrobe_item_id: str
    result_image_base64: str


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


@api_router.post("/upload-image", response_model=ImageUploadResponse)
async def upload_image(request: ImageUploadRequest):
    """
    Upload image to Supabase Storage and create thumbnail
    Returns URLs for both full and thumbnail images
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Convert base64 to bytes
        image_bytes = base64_to_bytes(request.image_base64)
        
        # Create thumbnail
        thumbnail_bytes = create_thumbnail(image_bytes, size=(300, 300))
        
        # Generate unique filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = request.filename or f"{timestamp}_{uuid.uuid4().hex[:8]}"
        full_path = f"{request.user_id}/{filename}_full.jpg"
        thumb_path = f"{request.user_id}/{filename}_thumb.jpg"
        
        # Upload full image
        full_upload = supabase.storage.from_(request.bucket).upload(
            path=full_path,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Upload thumbnail
        thumb_upload = supabase.storage.from_(request.bucket).upload(
            path=thumb_path,
            file=thumbnail_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Get public URLs
        full_url = supabase.storage.from_(request.bucket).get_public_url(full_path)
        thumb_url = supabase.storage.from_(request.bucket).get_public_url(thumb_path)
        
        logger.info(f"✅ Image uploaded: {full_path}")
        
        return ImageUploadResponse(
            success=True,
            full_url=full_url,
            thumbnail_url=thumb_url
        )
        
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return ImageUploadResponse(
            success=False,
            error=str(e)
        )


@api_router.post("/wardrobe-items")
async def create_wardrobe_item(item: WardrobeItemCreate):
    """
    Create wardrobe item in Supabase using service role key.
    This bypasses client-side RLS issues and centralizes write logic in the backend.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        payload = {
            "user_id": item.user_id,
            "name": item.name,
            "image_url": item.image_url,
            "thumbnail_url": item.thumbnail_url,
            "category": item.category,
        }

        if item.season:
            payload["season"] = item.season
        if item.color:
            payload["color"] = item.color

        # Supabase REST API endpoint
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/wardrobe_items"

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                rest_url,
                json=payload,
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
            )

            if resp.status_code >= 400:
                logger.error(
                    f"Supabase REST insert error: {resp.status_code} - {resp.text}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Supabase insert failed: {resp.status_code} - {resp.text}",
                )

        return {"success": True}
        
    except Exception as e:
        logger.error(f"Error: {e}")
        raise

@api_router.post("/tryon-results")
async def create_tryon_result(payload: TryOnResultCreate):
    """
    Save try-on result image to Supabase Storage and record URL in try_on_results table.
    Frontend sadece URL kullanacak, base64 DB'de tutulmayacak.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        # Convert base64 to bytes
        image_bytes = base64_to_bytes(payload.result_image_base64)

        # Use same bucket as wardrobe, farklı klasör altında
        from supabase import create_client, Client

        supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"{timestamp}_{uuid.uuid4().hex[:8]}_result.jpg"
        storage_path = f"{payload.user_id}/results/{file_name}"

        upload_res = supabase_client.storage.from_("wardrobe").upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"},
        )

        if getattr(upload_res, "error", None):
            logger.error(f"Supabase storage upload error: {upload_res.error}")
            raise HTTPException(status_code=500, detail=str(upload_res.error))

        image_url = supabase_client.storage.from_("wardrobe").get_public_url(
            storage_path
        )

        # Insert DB row via REST
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/try_on_results"
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                rest_url,
                json={
                    "user_id": payload.user_id,
                    "wardrobe_item_id": payload.wardrobe_item_id,
                    "result_image_url": image_url,
                },
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
            )

            if resp.status_code >= 400:
                logger.error(
                    f"Supabase REST insert (try_on_results) error: {resp.status_code} - {resp.text}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Supabase insert failed: {resp.status_code} - {resp.text}",
                )

        return {"success": True, "result_image_url": image_url}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Wardrobe item create error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Root health endpoint (for Docker health checks and load balancers)
@app.get("/health")
async def health_check():
    """
    Root-level health check endpoint.
    Tests MongoDB connection and returns service status.
    """
    try:
        # Test MongoDB connection
        await client.admin.command('ping')
        return {
            "status": "healthy",
            "service": "modli-backend",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "error": str(e)}
        )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_origins=ALLOWED_ORIGINS,  # Allow all origins for mobile apps
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
