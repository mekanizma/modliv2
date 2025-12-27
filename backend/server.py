from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.responses import HTMLResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
import base64
from PIL import Image
import io
from passlib.context import CryptContext
import secrets

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
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
ADMIN_TOKEN = os.environ.get('ADMIN_TOKEN', 'modli-admin-secret-token-change-in-production')
EXPO_ACCESS_TOKEN = os.environ.get('EXPO_ACCESS_TOKEN', '')
PUSH_TOKEN_TABLE = os.environ.get('PUSH_TOKEN_TABLE', 'push_tokens')
APP_LOGO_URL = os.environ.get('APP_LOGO_URL', '')  # Modli logo URL'i (Supabase storage veya public URL)

# Admin Credentials
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'modli@mekanizma.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '12345678')

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


# Push notification defaults
EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"
EXPO_MAX_BATCH = 90


# Utility Functions
def create_thumbnail(image_data: bytes, size: tuple = (300, 300)) -> bytes:
    """Create a thumbnail from image data"""
    try:
        # Validate input
        if not image_data or len(image_data) == 0:
            raise ValueError("Empty image data")
        
        # Create BytesIO from image data
        image_stream = io.BytesIO(image_data)
        
        # Open and verify image
        try:
            image = Image.open(image_stream)
            # Verify it's a valid image (this will raise an exception if invalid)
            image.verify()
        except Exception as img_error:
            logger.error(f"Cannot identify image file: {str(img_error)}")
            raise ValueError(f"Cannot identify image file: {str(img_error)}")
        
        # Reopen image for processing (verify() consumes the file)
        image_stream.seek(0)
        image = Image.open(image_stream)
        
        # Create thumbnail
        image.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        
        # Save to BytesIO
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=85, optimize=True)
        return output.getvalue()
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error creating thumbnail: {str(e)}")
        raise ValueError(f"Error creating thumbnail: {str(e)}")


def base64_to_bytes(base64_string: str) -> bytes:
    """Convert base64 string to bytes"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    return base64.b64decode(base64_string)


def bytes_to_base64(image_bytes: bytes) -> str:
    """Convert bytes to base64 string"""
    return f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode('utf-8')}"


def chunk_list(items: List[Any], size: int) -> List[List[Any]]:
    """Yield successive chunks from a list"""
    return [items[i:i + size] for i in range(0, len(items), size)]


def is_expo_push_token(token: str) -> bool:
    """Basic validation for Expo push tokens"""
    return isinstance(token, str) and (
        token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken")
    )


def is_fcm_token(token: str) -> bool:
    """Basic validation for FCM tokens (Play Store builds)"""
    # FCM token'ları genellikle uzun string'lerdir ve belirli bir pattern'e sahiptir
    # Expo Push API, FCM token'larını da kabul eder, bu yüzden tüm geçerli token'ları kabul edelim
    return isinstance(token, str) and len(token) > 20 and not token.startswith("ExponentPushToken") and not token.startswith("ExpoPushToken")


async def fetch_push_tokens_from_supabase(target_user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Supabase REST üzerinden push token listesini döndürür.
    Token'ları platform bilgisiyle birlikte döndürür.
    Varsayılan tablo adı: push_tokens (PUSH_TOKEN_TABLE env ile değiştirilebilir)
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase push token erişimi için yapılandırma eksik")

    rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{PUSH_TOKEN_TABLE}"

    params = {
        "select": "user_id,push_token,platform,updated_at",
        "push_token": "not.is.null",
    }

    if target_user_id:
        params["user_id"] = f"eq.{target_user_id}"

    async with httpx.AsyncClient(timeout=20.0) as http_client:
        resp = await http_client.get(
            rest_url,
            params=params,
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code != 200:
        error_detail = resp.text[:200] if resp.text else "Unknown error"
        logger.error(f"Push token fetch failed: {resp.status_code} - {error_detail}")
        raise HTTPException(status_code=500, detail="Push tokenları okunamadı")

    data = resp.json()
    tokens = []
    for row in data:
        token = row.get("push_token")
        platform = row.get("platform", "unknown")
        user_id = row.get("user_id")
        
        if token:
            # Hem Expo hem FCM token'larını kabul et
            # Expo Push API, her iki formatı da destekler
            tokens.append({
                "token": token,
                "platform": platform,
                "user_id": user_id,
                "is_expo": is_expo_push_token(token),
                "is_fcm": is_fcm_token(token)
            })
        else:
            logger.warning(f"Boş push token atlandı: {row}")

    # Benzersiz tut (token bazında)
    seen = set()
    unique_tokens = []
    for item in tokens:
        if item["token"] not in seen:
            seen.add(item["token"])
            unique_tokens.append(item)
    
    return unique_tokens


async def log_push_notification(
    title: str,
    body: str,
    target_user_id: Optional[str],
    sent_count: int,
    failed_count: int,
    tokens_info: List[Dict[str, Any]],
    errors: List[str]
):
    """Push notification'ı MongoDB'ye logla"""
    try:
        log_entry = {
            "id": str(uuid.uuid4()),
            "title": title,
            "body": body,
            "target_user_id": target_user_id,
            "sent_count": sent_count,
            "failed_count": failed_count,
            "total_tokens": len(tokens_info),
            "tokens_info": tokens_info,
            "errors": errors,
            "created_at": datetime.utcnow(),
            "timestamp": datetime.utcnow().isoformat()
        }
        await db.push_notification_logs.insert_one(log_entry)
        logger.info(f"Push notification logged: {log_entry['id']}")
    except Exception as e:
        logger.error(f"Push notification loglama hatası: {str(e)}")


async def get_app_logo_url() -> Optional[str]:
    """Modli uygulama logosunun URL'ini döndürür"""
    # Önce environment variable'dan kontrol et
    if APP_LOGO_URL:
        return APP_LOGO_URL
    
    # Supabase storage'dan logo URL'ini al (eğer varsa)
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client, Client
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
            
            # Logo dosyasını storage'dan al (public/logo.png veya benzeri)
            logo_paths = ["public/modli-logo.png", "public/logo.png", "modli-logo.png"]
            for path in logo_paths:
                try:
                    public_url = supabase.storage.from_("wardrobe").get_public_url(path)
                    # URL'in geçerli olup olmadığını kontrol et
                    if public_url and "supabase.co" in public_url:
                        return public_url
                except:
                    continue
        except Exception as e:
            logger.warning(f"Logo URL alınamadı: {str(e)}")
    
    return None


async def send_expo_push_notifications(
    tokens_info: List[Dict[str, Any]], title: str, body: str, data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Expo Push API üzerinden bildirim gönderir.
    Hem Expo hem FCM token'larını destekler (Expo Push API her ikisini de handle eder).
    Modli logosu ve ismi ile gönderilir.
    """
    if not tokens_info:
        return {"sent": [], "failed": [], "errors": ["Kayıtlı push token yok"]}
    
    # Logo URL'ini al
    logo_url = await get_app_logo_url()

    # Tüm token'ları mesaj formatına çevir (Expo Push API hem Expo hem FCM token'larını kabul eder)
    # Modli logo ve isim bilgilerini ekle
    notification_data = {
        "app_name": "Modli",
        **(data or {})
    }
    
    messages = []
    for token_item in tokens_info:
        if not token_item.get("token"):
            continue
            
        platform = token_item.get("platform", "unknown")
        message = {
            "to": token_item["token"],
            "sound": "default",
            "title": title,
            "body": body,
            "subtitle": "Modli",  # iOS için alt başlık - "Expo" yerine "Modli" görünecek
            "data": notification_data,
            "priority": "default",
        }
        
        # Android için icon ekle (logo URL'i varsa)
        if logo_url and platform == "android":
            message["icon"] = logo_url
        
        # Android için channel ID (opsiyonel, daha iyi kontrol için)
        if platform == "android":
            message["channelId"] = "default"
        
        messages.append(message)

    if not messages:
        return {"sent": [], "failed": [], "errors": ["Geçerli push token yok"]}

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"

    sent_tokens: List[str] = []
    failed: List[Dict[str, Any]] = []
    errors: List[str] = []

    async with httpx.AsyncClient(timeout=20.0) as http_client:
        for chunk in chunk_list(messages, EXPO_MAX_BATCH):
            try:
                resp = await http_client.post(EXPO_PUSH_API_URL, json=chunk, headers=headers)
            except Exception as exc:
                logger.error(f"Expo push gönderim hatası: {str(exc)}")
                errors.append(str(exc))
                # Chunk'taki tüm token'ları failed olarak işaretle
                for msg in chunk:
                    failed.append({
                        "token": msg.get("to"),
                        "error": str(exc),
                        "details": None
                    })
                continue

            if resp.status_code != 200:
                error_detail = resp.text[:200] if resp.text else "Unknown error"
                logger.error(f"Expo push API hatası: {resp.status_code} - {error_detail}")
                for msg in chunk:
                    failed.append({
                        "token": msg.get("to"),
                        "error": error_detail,
                        "details": None
                    })
                continue

            resp_json = resp.json()
            results = resp_json.get("data", [])

            for msg, result in zip(chunk, results):
                token = msg.get("to")
                if result.get("status") == "ok":
                    sent_tokens.append(token)
                else:
                    failed.append(
                        {
                            "token": token,
                            "error": result.get("message") or "Bilinmeyen hata",
                            "details": result.get("details"),
                        }
                    )

    return {"sent": sent_tokens, "failed": failed, "errors": errors}


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class TryOnRequest(BaseModel):
    user_id: str
    user_image: str  # public URL for user image
    clothing_image: str  # public URL for clothing image
    clothing_category: str
    is_free_trial: bool = False  # True if using free trial credit

class TryOnResponse(BaseModel):
    success: bool
    result_image_url: Optional[str] = None
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
    result_image_url: str

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory session storage (production'da Redis kullanılmalı)
admin_sessions: dict[str, dict] = {}

# Admin Models
class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    error: Optional[str] = None

class UserUpdateRequest(BaseModel):
    credits: Optional[int] = None
    subscription_tier: Optional[str] = None
    subscription_status: Optional[str] = None

class NotificationRequest(BaseModel):
    title: str
    body: str
    user_id: Optional[str] = None  # None = tüm kullanıcılara gönder
    data: Optional[dict] = None


# Routes
@api_router.get("/")
async def root():
    return {"message": "Modli API - Virtual Try-On Service"}


@app.get("/auth/callback")
async def oauth_callback(
    request: Request,
    access_token: str = None,
    refresh_token: str = None,
    type: str = None,
    error: str = None,
    error_description: str = None,
):
    """
    OAuth callback endpoint - token'ları alıp uygulamaya deep link ile yönlendirir.
    HTTP 302 redirect kullanarak direkt deep link'e yönlendirme yapar.
    """
    # Hata varsa hata sayfası göster
    if error:
        error_msg = error_description or error
        logger.error(f"OAuth error: {error_msg}")
        html = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Giriş Hatası • Modli</title>
    <style>
        body {{
            margin: 0;
            padding: 20px;
            background: #0a0a0a;
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }}
        .error {{
            text-align: center;
            max-width: 400px;
        }}
        .error h1 {{
            color: #f97373;
            font-size: 24px;
            margin-bottom: 16px;
        }}
        .error p {{
            color: #9ca3af;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="error">
        <h1>Giriş Hatası</h1>
        <p>{error_msg}</p>
        <p>Lütfen uygulamaya dönüp tekrar deneyin.</p>
    </div>
</body>
</html>
        """
        return HTMLResponse(content=html, status_code=400)
    
    # Token'lar varsa başarı sayfası göster
    # Android Chrome Custom Tabs için token'ları URL'de tutuyoruz (meta refresh yok)
    # openAuthSessionAsync bu URL'i döndürecek ve app token'ları parse edecek
    if access_token and refresh_token:
        logger.info(f"OAuth callback successful - keeping tokens in URL for app to parse")

        # Token'ları URL'de tut - openAuthSessionAsync bunu döndürecek
        # Android'de meta refresh kullanmıyoruz çünkü Chrome Custom Tabs session'ı kapatamıyor
        html = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Giriş Başarılı • Modli</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0a0a0a;
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
        }}
        .container {{
            text-align: center;
            padding: 20px;
            max-width: 400px;
        }}
        .success {{
            font-size: 48px;
            margin-bottom: 20px;
        }}
        h1 {{
            font-size: 24px;
            margin: 0 0 12px 0;
            color: #10b981;
        }}
        p {{
            color: #9ca3af;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✓</div>
        <h1>Giriş Başarılı</h1>
        <p>Uygulamaya dönebilirsiniz.</p>
    </div>
</body>
</html>
        """
        return HTMLResponse(content=html)
    
    # Token yoksa fallback HTML sayfası
    # Bu durumda token'lar fragment (#) ile gelmiş olabilir (Supabase OAuth'un normal davranışı)
    # Fragment sunucu tarafında görünmez, ama openAuthSessionAsync bunu görebilir ve app'e döndürür
    # JavaScript redirect KULLANMIYORUZ - Chrome Custom Tabs session'ı düzgün kapanabilsin
    html = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Giriş Başarılı • Modli</title>
    <style>
        body {{
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0a0a0a;
            color: #fff;
            font-family: system-ui, -apple-system, sans-serif;
        }}
        .container {{
            text-align: center;
            padding: 20px;
            max-width: 400px;
        }}
        .success {{
            font-size: 48px;
            margin-bottom: 20px;
        }}
        h1 {{
            font-size: 24px;
            margin: 0 0 12px 0;
            color: #10b981;
        }}
        p {{
            color: #9ca3af;
            line-height: 1.6;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✓</div>
        <h1>Giriş Başarılı</h1>
        <p>Uygulamaya dönebilirsiniz.</p>
    </div>
    <script>
        (function() {{
            console.log('OAuth callback page loaded');

            const hash = window.location.hash.substring(1);
            if (!hash) {{
                console.error('No hash fragment found');
                return;
            }}

            const hashParams = new URLSearchParams(hash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            console.log('Tokens:', accessToken ? 'found' : 'missing', refreshToken ? 'found' : 'missing');

            // Token'lar varsa deep link'i tetikle
            // Android Chrome Custom Tabs otomatik kapanmadığı için deep link ile app'i açıyoruz
            // Deep link handler (_layout.tsx) token'ları alıp session'ı başlatacak
            if (accessToken && refreshToken) {{
                console.log('Tokens found - triggering deep link to open app');

                const deepLink = `modli://auth/callback?access_token=${{encodeURIComponent(accessToken)}}&refresh_token=${{encodeURIComponent(refreshToken)}}&type=oauth`;

                console.log('Deep link:', deepLink);

                // Küçük bir delay ile deep link'i tetikle (sayfa yüklenmesini bekle)
                setTimeout(function() {{
                    window.location.href = deepLink;
                }}, 100);
            }} else {{
                console.error('Tokens not found in hash');
            }}
        }})();
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html)


@app.get("/reset-password", response_class=HTMLResponse)
async def reset_password_page():
    """
    Kullanıcıların mobil deep link yerine doğrudan web sayfası üzerinden
    Supabase şifre sıfırlama yapabilmesi için basit bir HTML sayfası döner.

    Not:
    - Supabase Auth ayarlarında password recovery redirect URL'i
      https://modli.mekanizma.com/reset-password olarak yapılandırılmalı.
    - Supabase, bu URL'e #access_token=... içeren bir hash ile yönlendirir.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return HTMLResponse(
            "<h1>Configuration error</h1><p>Supabase URL veya anon key eksik.</p>",
            status_code=500,
        )

    html = f"""
<!DOCTYPE html>
<html lang="tr" id="htmlLang">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title id="pageTitle">Şifre Sıfırla • Modli</title>
    <style>
      :root {{
        color-scheme: dark;
        --bg: #020617;
        --card-bg: #020617;
        --card-border: #1f2937;
        --accent: #6366f1;
        --accent-soft: rgba(99, 102, 241, 0.15);
        --accent-strong: rgba(129, 140, 248, 0.55);
        --text: #f9fafb;
        --muted: #9ca3af;
        --danger: #f97373;
      }}

      * {{
        box-sizing: border-box;
      }}

      html, body {{
        margin: 0;
        padding: 0;
        height: 100%;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
          "Roboto", sans-serif;
        background: radial-gradient(circle at top, #020617 0, #020617 40%, #020617 100%);
        color: var(--text);
      }}

      body {{
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }}

      .shell {{
        width: 100%;
        max-width: 420px;
      }}

      .logo-row {{
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
      }}

      .logo-mark {{
        width: 40px;
        height: 40px;
        border-radius: 16px;
        background: radial-gradient(circle at 0 0, #fbbf24, #f97316 36%, #4f46e5 100%);
        box-shadow:
          0 0 0 1px rgba(15, 23, 42, 0.8),
          0 18px 45px rgba(15, 23, 42, 0.9);
      }}

      .brand-title {{
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-size: 13px;
        color: var(--muted);
      }}

      .card {{
        position: relative;
        border-radius: 24px;
        padding: 24px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid var(--card-border);
        box-shadow:
          0 24px 60px rgba(15, 23, 42, 0.95),
          0 0 0 1px rgba(148, 163, 184, 0.06);
        overflow: hidden;
      }}

      .card::before {{
        content: "";
        position: absolute;
        inset: -120px;
        background:
          radial-gradient(circle at 0 0, rgba(96, 165, 250, 0.18), transparent 60%),
          radial-gradient(circle at 100% 0, rgba(244, 114, 182, 0.16), transparent 55%);
        opacity: 0.6;
        pointer-events: none;
      }}

      .card-inner {{
        position: relative;
        z-index: 1;
      }}

      .chip-row {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }}

      .chip {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.7);
        border: 1px solid rgba(148, 163, 184, 0.28);
        font-size: 11px;
        color: var(--muted);
      }}

      .chip-dot {{
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: radial-gradient(circle at 0 0, #22c55e, #16a34a);
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
      }}

      .headline {{
        margin: 0 0 6px;
        font-size: 22px;
        font-weight: 650;
        letter-spacing: -0.02em;
      }}

      .subcopy {{
        margin: 0 0 20px;
        font-size: 14px;
        color: var(--muted);
        line-height: 1.5;
      }}

      .field {{
        margin-bottom: 16px;
      }}

      label {{
        display: block;
        font-size: 13px;
        margin-bottom: 6px;
        color: #e5e7eb;
      }}

      .input-wrap {{
        display: flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        background: rgba(15, 23, 42, 0.9);
        padding: 0 14px;
      }}

      .input-wrap:focus-within {{
        border-color: rgba(129, 140, 248, 0.9);
        box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.6);
      }}

      .input-icon {{
        width: 18px;
        height: 18px;
        margin-right: 8px;
        flex-shrink: 0;
        opacity: 0.9;
      }}

      input[type="password"],
      input[type="text"] {{
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        color: var(--text);
        padding: 10px 0;
        font-size: 15px;
      }}

      input::placeholder {{
        color: rgba(148, 163, 184, 0.75);
      }}

      .toggle-btn {{
        border: none;
        background: none;
        color: var(--muted);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
        padding-left: 8px;
      }}

      .error-text {{
        font-size: 13px;
        color: var(--danger);
        margin-top: 6px;
      }}

      .hint {{
        font-size: 12px;
        color: var(--muted);
        margin-top: 6px;
      }}

      .submit {{
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }}

      .btn-primary {{
        position: relative;
        border: none;
        border-radius: 999px;
        padding: 10px 16px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        cursor: pointer;
        color: #0b1020;
        background: linear-gradient(135deg, #4f46e5, #6366f1, #f97316);
        box-shadow:
          0 16px 40px rgba(79, 70, 229, 0.45),
          0 0 0 1px rgba(15, 23, 42, 0.8);
      }}

      .btn-primary[disabled] {{
        opacity: 0.6;
        cursor: default;
        box-shadow: none;
      }}

      .btn-secondary {{
        border-radius: 999px;
        padding: 8px 14px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        background: rgba(15, 23, 42, 0.8);
        font-size: 12px;
        color: var(--muted);
      }}

      .badge-row {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
        font-size: 11px;
        color: var(--muted);
      }}

      .made-for {{
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }}

      .pill {{
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.9);
      }}

      .status-text {{
        font-size: 13px;
      }}

      .status-ok {{
        color: #4ade80;
      }}

      .status-warn {{
        color: #facc15;
      }}

      .status-error {{
        color: var(--danger);
      }}

      .status-pill {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(15, 23, 42, 0.85);
        font-size: 12px;
      }}

      .status-dot {{
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #fbbf24;
      }}

      .lang-toggle {{
        margin-left: auto;
        padding: 6px 12px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.35);
        color: var(--text);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }}

      .lang-toggle:hover {{
        background: rgba(15, 23, 42, 0.95);
        border-color: rgba(148, 163, 184, 0.5);
      }}

      .success-message {{
        display: none;
        padding: 24px 20px;
        border-radius: 20px;
        background: rgba(34, 197, 94, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.35);
        margin-top: 18px;
        text-align: center;
      }}

      .success-message.show {{
        display: block;
      }}

      .success-icon {{
        font-size: 40px;
        margin-bottom: 10px;
      }}

      .success-title {{
        font-size: 20px;
        font-weight: 700;
        color: #4ade80;
        margin-bottom: 12px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }}

      .success-text {{
        font-size: 15px;
        font-weight: 600;
        color: #e5e7eb;
        line-height: 1.6;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }}

      @media (max-width: 480px) {{
        .card {{
          border-radius: 20px;
          padding: 20px 18px;
        }}

        .headline {{
          font-size: 20px;
        }}
      }}
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="logo-row">
        <div class="logo-mark"></div>
        <div>
          <div class="brand-title">MODLI</div>
          <div style="font-size: 11px; color: var(--muted);">
            Akıllı gardırop &amp; sanal deneme
          </div>
        </div>
        <button class="lang-toggle" id="langToggle" onclick="toggleLanguage()">EN</button>
      </div>

      <main class="card" aria-labelledby="headline">
        <div class="card-inner">
          <div class="chip-row">
            <div class="chip">
              <span class="chip-dot"></span>
              <span id="chipSecure">Güvenli şifre sıfırlama</span>
            </div>
            <div class="chip">Web • iOS • Android</div>
          </div>

          <h1 id="headline" class="headline"><span id="titleText">Yeni şifreni belirle</span></h1>
          <p class="subcopy" id="subcopyText">
            E-posta adresine gönderdiğimiz bağlantı üzerinden geldin.
            Güvenlik için buradan yeni Modli şifreni oluşturabilirsin.
          </p>

          <form id="resetForm" novalidate>
            <div class="field">
              <label for="password"><span id="labelPassword">Yeni şifre</span></label>
              <div class="input-wrap">
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17 11V8C17 5.24 14.76 3 12 3C9.24 3 7 5.24 7 8V11"
                    stroke="#9CA3AF"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="3"
                    stroke="#9CA3AF"
                    stroke-width="1.6"
                  />
                  <circle cx="12" cy="16" r="1.4" fill="#9CA3AF" />
                </svg>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="new-password"
                  minlength="6"
                  placeholder=""
                  required
                />
                <button
                  class="toggle-btn"
                  type="button"
                  id="toggleVisibility"
                  aria-label=""
                >
                  <span id="toggleText">GÖSTER</span>
                </button>
              </div>
              <p class="hint" id="hintText">
                En iyi güvenlik için; en az 1 rakam, 1 harf ve 1 özel karakter öneriyoruz.
              </p>
            </div>

            <div class="field">
              <label for="confirm"><span id="labelConfirm">Şifreyi tekrar yaz</span></label>
              <div class="input-wrap">
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17 11V8C17 5.24 14.76 3 12 3C9.24 3 7 5.24 7 8V11"
                    stroke="#9CA3AF"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="3"
                    stroke="#9CA3AF"
                    stroke-width="1.6"
                  />
                  <circle cx="12" cy="16" r="1.4" fill="#9CA3AF" />
                </svg>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autocomplete="new-password"
                  minlength="6"
                  placeholder=""
                  required
                />
              </div>
            </div>

            <p id="error" class="error-text" role="alert" style="display: none;"></p>

            <div class="submit">
              <button id="submitBtn" type="submit" class="btn-primary">
                <span id="submitText">Şifreyi güncelle</span>
              </button>
            </div>

            <div class="success-message" id="successMessage">
              <div class="success-icon">✓</div>
              <div class="success-title" id="successTitle">TEŞEKKÜRLER</div>
              <div class="success-text" id="successText">
                ŞİFRENİZ BAŞARI İLE DEĞİŞTİRİLDİ UYGULAMAYA GERİ DÖNEBİLİRSİNİZ
              </div>
            </div>

            <div class="badge-row" aria-live="polite" aria-atomic="true">
              <div class="made-for">
                <span class="pill"><span id="badgeText">Geri dönüşümlü gardırop</span></span>
              </div>
              <div class="status-pill" id="linkStatus">
                <span class="status-dot"></span>
                <span class="status-text status-warn">
                  <span id="statusText">Bağlantı doğrulanıyor…</span>
                </span>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>

    <script>
      const SUPABASE_URL = {SUPABASE_URL!r};
      const SUPABASE_ANON_KEY = {SUPABASE_ANON_KEY!r};

      const passwordInput = document.getElementById("password");
      const confirmInput = document.getElementById("confirm");
      const toggleBtn = document.getElementById("toggleVisibility");
      const errorEl = document.getElementById("error");
      const form = document.getElementById("resetForm");
      const submitBtn = document.getElementById("submitBtn");
      const linkStatus = document.getElementById("linkStatus");
      const successMessage = document.getElementById("successMessage");

      let accessToken = null;
      let currentLang = localStorage.getItem("modli_lang") || "tr";

      const translations = {{
        tr: {{
          chipSecure: "Güvenli şifre sıfırlama",
          title: "Yeni şifrenizi belirleyin.",
          subcopy: "E-posta adresinize gönderdiğimiz bağlantı üzerinden buraya ulaştınız. Güvenlik amacıyla, yeni Modli şifrenizi buradan oluşturabilirsiniz.",
          labelPassword: "Yeni şifre",
          labelConfirm: "Şifreyi tekrar yaz",
          passwordPlaceholder: "En az 6 karakter",
          confirmPlaceholder: "Tekrar yeni şifre",
          toggleShow: "GÖSTER",
          toggleHide: "GİZLE",
          hint: "En iyi güvenlik için; en az 1 rakam, 1 harf ve 1 özel karakter öneriyoruz.",
          submit: "Şifreyi güncelle",
          submitting: "Güncelleniyor…",
          badge: "Geri dönüşümlü gardırop",
          statusValidating: "Bağlantı doğrulanıyor…",
          statusValid: "Bağlantın doğrulandı. Yeni şifreni belirleyebilirsin.",
          statusInvalid: "Bağlantı geçersiz veya süresi dolmuş. Lütfen yeniden şifre sıfırlama iste.",
          statusError: "Bağlantı okunamadı. Lütfen e-postandaki linke tekrar tıkla.",
          errorInvalidLink: "Geçersiz bağlantı. Lütfen e-posta kutundan yeni bir şifre sıfırlama iste.",
          errorEmptyFields: "Lütfen tüm alanları doldur.",
          errorShortPassword: "Şifre en az 6 karakter olmalı.",
          errorMismatch: "Şifreler birbiriyle eşleşmiyor.",
          errorUpdateFailed: "Şifre güncellenemedi. Lütfen bağlantıyı tekrar deneyin.",
          errorGeneric: "Bir hata oluştu. Lütfen birkaç dakika sonra tekrar dene.",
          successTitle: "TEŞEKKÜRLER",
          successText: "ŞİFRENİZ BAŞARI İLE DEĞİŞTİRİLDİ UYGULAMAYA GERİ DÖNEBİLİRSİNİZ",
        }},
        en: {{
          chipSecure: "Secure password reset",
          title: "Set your new password",
          subcopy: "You have reached this page via the link we sent to your email address. For security reasons, you can create your new Modli password here.",
          labelPassword: "New password",
          labelConfirm: "Confirm password",
          passwordPlaceholder: "At least 6 characters",
          confirmPlaceholder: "Re-enter new password",
          toggleShow: "SHOW",
          toggleHide: "HIDE",
          hint: "For best security, we recommend at least 1 number, 1 letter, and 1 special character.",
          submit: "Update password",
          submitting: "Updating…",
          badge: "Sustainable wardrobe",
          statusValidating: "Validating link…",
          statusValid: "Your link is verified. You can set your new password.",
          statusInvalid: "Link is invalid or expired. Please request a new password reset.",
          statusError: "Link could not be read. Please click the link in your email again.",
          errorInvalidLink: "Invalid link. Please request a new password reset from your inbox.",
          errorEmptyFields: "Please fill in all fields.",
          errorShortPassword: "Password must be at least 6 characters.",
          errorMismatch: "Passwords do not match.",
          errorUpdateFailed: "Password could not be updated. Please try the link again.",
          errorGeneric: "An error occurred. Please try again in a few minutes.",
          successTitle: "THANK YOU",
          successText: "YOUR PASSWORD HAS BEEN SUCCESSFULLY CHANGED. YOU CAN RETURN TO THE APP.",
        }}
      }};

      function updateLanguage(lang) {{
        currentLang = lang;
        localStorage.setItem("modli_lang", lang);
        const t = translations[lang];
        
        document.getElementById("htmlLang").setAttribute("lang", lang);
        document.getElementById("pageTitle").textContent = lang === "tr" ? "Şifre Sıfırla • Modli" : "Reset Password • Modli";
        document.getElementById("chipSecure").textContent = t.chipSecure;
        document.getElementById("titleText").textContent = t.title;
        document.getElementById("subcopyText").textContent = t.subcopy;
        document.getElementById("labelPassword").textContent = t.labelPassword;
        document.getElementById("labelConfirm").textContent = t.labelConfirm;
        passwordInput.placeholder = t.passwordPlaceholder;
        confirmInput.placeholder = t.confirmPlaceholder;
        document.getElementById("toggleText").textContent = passwordInput.type === "password" ? t.toggleShow : t.toggleHide;
        document.getElementById("hintText").textContent = t.hint;
        document.getElementById("submitText").textContent = t.submit;
        document.getElementById("badgeText").textContent = t.badge;
        document.getElementById("successTitle").textContent = t.successTitle;
        document.getElementById("successText").textContent = t.successText;
        
        const langToggle = document.getElementById("langToggle");
        langToggle.textContent = lang === "tr" ? "EN" : "TR";
        
        if (linkStatus) {{
          const statusTextEl = document.getElementById("statusText");
          if (statusTextEl) {{
            const currentStatus = linkStatus.querySelector(".status-text").classList.contains("status-ok") ? "ok" : 
                                 linkStatus.querySelector(".status-text").classList.contains("status-error") ? "error" : "warn";
            if (currentStatus === "ok") {{
              statusTextEl.textContent = t.statusValid;
            }} else if (currentStatus === "error") {{
              statusTextEl.textContent = t.statusInvalid;
            }} else {{
              statusTextEl.textContent = t.statusValidating;
            }}
          }}
        }}
      }}

      function toggleLanguage() {{
        const newLang = currentLang === "tr" ? "en" : "tr";
        updateLanguage(newLang);
      }}

      function parseHash() {{
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        return {{
          access_token: params.get("access_token"),
          type: params.get("type"),
        }};
      }}

      function setStatus(kind, text) {{
        if (!linkStatus) return;
        const textSpan = linkStatus.querySelector(".status-text");
        if (!textSpan) return;
        const statusTextEl = document.getElementById("statusText");
        if (statusTextEl) {{
          statusTextEl.textContent = text;
        }} else {{
          textSpan.textContent = text;
        }}
        textSpan.classList.remove("status-ok", "status-warn", "status-error");
        if (kind === "ok") textSpan.classList.add("status-ok");
        else if (kind === "error") textSpan.classList.add("status-error");
        else textSpan.classList.add("status-warn");
      }}

      function showError(msg) {{
        errorEl.style.display = "block";
        errorEl.textContent = msg;
      }}

      function clearError() {{
        errorEl.style.display = "none";
        errorEl.textContent = "";
      }}

      (function init() {{
        updateLanguage(currentLang);
        
        try {{
          const {{ access_token, type }} = parseHash();
          const t = translations[currentLang];
          
          if (!access_token) {{
            setStatus("error", t.statusInvalid);
            submitBtn.disabled = true;
            return;
          }}
          if (type && type !== "recovery") {{
            setStatus("warn", t.statusValidating);
          }} else {{
            setStatus("ok", t.statusValid);
          }}
          accessToken = access_token;
        }} catch (e) {{
          console.error(e);
          const t = translations[currentLang];
          setStatus("error", t.statusError);
          submitBtn.disabled = true;
        }}
      }})();

      toggleBtn.addEventListener("click", () => {{
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        confirmInput.type = isPassword ? "text" : "password";
        const t = translations[currentLang];
        document.getElementById("toggleText").textContent = isPassword ? t.toggleHide : t.toggleShow;
      }});

      form.addEventListener("submit", async (event) => {{
        event.preventDefault();
        clearError();
        const t = translations[currentLang];

        if (!accessToken) {{
          showError(t.errorInvalidLink);
          return;
        }}

        const password = passwordInput.value.trim();
        const confirm = confirmInput.value.trim();

        if (!password || !confirm) {{
          showError(t.errorEmptyFields);
          return;
        }}
        if (password.length < 6) {{
          showError(t.errorShortPassword);
          return;
        }}
        if (password !== confirm) {{
          showError(t.errorMismatch);
          return;
        }}

        submitBtn.disabled = true;
        document.getElementById("submitText").textContent = t.submitting;

        try {{
          const res = await fetch(SUPABASE_URL.replace(/\\/$/, "") + "/auth/v1/user", {{
            method: "PUT",
            headers: {{
              "Content-Type": "application/json",
              apikey: SUPABASE_ANON_KEY,
              Authorization: "Bearer " + accessToken,
            }},
            body: JSON.stringify({{ password }}),
          }});

          if (!res.ok) {{
            const data = await res.json().catch(() => ({{}}));
            const msg =
              data?.error_description ||
              data?.message ||
              t.errorUpdateFailed;
            showError(msg);
            submitBtn.disabled = false;
            document.getElementById("submitText").textContent = t.submit;
            return;
          }}

          // Formu ve diğer metinleri gizle, sadece teşekkürler mesajını göster
          form.style.display = "none";

          const chipRow = document.querySelector(".chip-row");
          if (chipRow) chipRow.style.display = "none";

          const headline = document.getElementById("headline");
          if (headline) headline.style.display = "none";

          const subcopy = document.getElementById("subcopyText");
          if (subcopy) subcopy.style.display = "none";

          const badgeRow = document.querySelector(".badge-row");
          if (badgeRow) badgeRow.style.display = "none";

          successMessage.classList.add("show");
          
          // Sayfayı yukarı kaydır
          successMessage.scrollIntoView({{ behavior: "smooth", block: "start" }});
        }} catch (err) {{
          console.error(err);
          showError(t.errorGeneric);
          submitBtn.disabled = false;
          document.getElementById("submitText").textContent = t.submit;
        }}
      }});
    </script>
  </body>
</html>
    """

    return HTMLResponse(content=html)

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


# Authentication Functions
async def verify_supabase_user(authorization: str = Header(None)):
    """
    Verify Supabase JWT token and return user info.
    Raises HTTPException if token is invalid.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization.replace("Bearer ", "")
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase authentication not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY
                }
            )
            
            if response.status_code != 200:
                logger.warning(f"Invalid Supabase token: {response.status_code}")
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            user_data = response.json()
            return user_data
            
    except httpx.RequestError as e:
        logger.error(f"Supabase auth error: {str(e)}")
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication error")


async def try_on_with_fal(user_image: str, clothing_image: str, http_client: httpx.AsyncClient, user_id: Optional[str] = None) -> TryOnResponse:
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
                        result_url: Optional[str] = None

                        if SUPABASE_URL and SUPABASE_KEY:
                            try:
                                from supabase import create_client, Client
                                supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

                                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                                filename = f"{timestamp}_{uuid.uuid4().hex[:8]}_result.jpg"
                                storage_path = f"{user_id or 'public'}/results/{filename}"

                                upload_res = supabase.storage.from_("wardrobe").upload(
                                    path=storage_path,
                                    file=img_response.content,
                                    file_options={"content-type": "image/jpeg"},
                                )

                                if getattr(upload_res, "error", None):
                                    logger.error(f"Supabase storage upload error: {upload_res.error}")
                                else:
                                    result_url = supabase.storage.from_("wardrobe").get_public_url(storage_path)
                            except Exception as e:
                                logger.error(f"Supabase upload failed for try-on result: {str(e)}")

                        if not result_url:
                            result_url = image_url

                        logger.info("Successfully generated try-on image via fal.ai!")
                        return TryOnResponse(
                            success=True,
                            result_image_url=result_url
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
async def virtual_try_on(
    request: TryOnRequest,
    user = Depends(verify_supabase_user)
):
    """
    Generate a virtual try-on image using fal.ai
    - All users (including free trial) use fal.ai for best quality
    - Generates 1 image per request
    - Requires valid Supabase JWT token
    """
    try:
        # Get authenticated user ID from token
        authenticated_user_id = user.get("id")
        
        # Security check: request.user_id must match token user_id
        if request.user_id != authenticated_user_id:
            logger.warning(f"User ID mismatch: token={authenticated_user_id}, request={request.user_id}")
            raise HTTPException(status_code=403, detail="Forbidden")
        
        logger.info(f"Try-on request - user: {request.user_id}, category: {request.clothing_category}")
        
        async with httpx.AsyncClient(timeout=300.0) as http_client:
            # All users use fal.ai for consistent high quality
            return await try_on_with_fal(
                request.user_image,
                request.clothing_image,
                http_client,
                request.user_id
            )
            
    except httpx.TimeoutException:
        logger.error("Request timed out")
        return TryOnResponse(success=False, error="Request timed out. Please try again.")
    except HTTPException:
        raise
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
async def upload_image(
    file: UploadFile = File(...),
    bucket: str = Form("wardrobe"),
    user_id: str = Form(...),
    filename: Optional[str] = Form(None),
    user = Depends(verify_supabase_user)
):
    """
    Upload image to Supabase Storage and create thumbnail
    Returns URLs for both full and thumbnail images
    Requires valid Supabase JWT token
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    # Get authenticated user ID from token
    authenticated_user_id = user.get("id")
    
    # Security check: user_id must match token user_id
    if user_id != authenticated_user_id:
        logger.warning(f"User ID mismatch: token={authenticated_user_id}, request={user_id}")
        raise HTTPException(status_code=403, detail="Forbidden")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Read image data once and store it
        image_bytes = await file.read()
        
        # Validate image data
        if not image_bytes or len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Create thumbnail (this will validate the image and raise ValueError if invalid)
        try:
            thumbnail_bytes = create_thumbnail(image_bytes, size=(300, 300))
        except ValueError as thumb_error:
            logger.error(f"Thumbnail creation failed: {str(thumb_error)}")
            raise HTTPException(status_code=400, detail=str(thumb_error))
        
        # Generate unique filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = filename or f"{timestamp}_{uuid.uuid4().hex[:8]}"
        full_path = f"{user_id}/{safe_name}_full.jpg"
        thumb_path = f"{user_id}/{safe_name}_thumb.jpg"
        
        # Upload full image
        full_upload = supabase.storage.from_(bucket).upload(
            path=full_path,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Upload thumbnail
        thumb_upload = supabase.storage.from_(bucket).upload(
            path=thumb_path,
            file=thumbnail_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Get public URLs
        full_url = supabase.storage.from_(bucket).get_public_url(full_path)
        thumb_url = supabase.storage.from_(bucket).get_public_url(thumb_path)
        
        logger.info(f"✅ Image uploaded: {full_path}")
        
        return ImageUploadResponse(
            success=True,
            full_url=full_url,
            thumbnail_url=thumb_url
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return ImageUploadResponse(
            success=False,
            error=str(e)
        )


@api_router.post("/wardrobe-items")
async def create_wardrobe_item(
    item: WardrobeItemCreate,
    user = Depends(verify_supabase_user)
):
    """
    Create wardrobe item in Supabase using service role key.
    This bypasses client-side RLS issues and centralizes write logic in the backend.
    Requires valid Supabase JWT token
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    # Get authenticated user ID from token
    authenticated_user_id = user.get("id")
    
    # Security check: item.user_id must match token user_id
    if item.user_id != authenticated_user_id:
        logger.warning(f"User ID mismatch: token={authenticated_user_id}, request={item.user_id}")
        raise HTTPException(status_code=403, detail="Forbidden")

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
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error: {e}")
        raise

@api_router.post("/tryon-results")
async def create_tryon_result(
    payload: TryOnResultCreate,
    user = Depends(verify_supabase_user)
):
    """
    Save try-on result image to Supabase Storage and record URL in try_on_results table.
    Frontend sadece URL kullanacak, base64 DB'de tutulmayacak.
    Requires valid Supabase JWT token
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    # Get authenticated user ID from token
    authenticated_user_id = user.get("id")
    
    # Security check: payload.user_id must match token user_id
    if payload.user_id != authenticated_user_id:
        logger.warning(f"User ID mismatch: token={authenticated_user_id}, request={payload.user_id}")
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        image_url = payload.result_image_url

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
        logger.error(f"Try-on result create error: {str(e)}")
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


# Admin Authentication
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

async def verify_admin_session(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Verify admin session token - Geçici olarak devre dışı"""
    # Geçici olarak authentication kontrolü kaldırıldı
    return {"email": "admin@modli.com", "created_at": datetime.utcnow()}

# Admin Router
admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

@admin_router.post("/login")
async def admin_login(request: AdminLoginRequest):
    """Admin login endpoint with email and password"""
    # Check email
    if request.email.lower() != ADMIN_EMAIL.lower():
        return AdminLoginResponse(success=False, error="Invalid email or password")
    
    # Check password (plain text comparison for simplicity, production'da hash kullanılmalı)
    if request.password != ADMIN_PASSWORD:
        return AdminLoginResponse(success=False, error="Invalid email or password")
    
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    # Store session
    admin_sessions[session_token] = {
        "email": request.email,
        "created_at": datetime.utcnow(),
        "expires_at": expires_at
    }
    
    logger.info(f"Admin login successful: {request.email}")
    return AdminLoginResponse(success=True, token=session_token)

@admin_router.get("/users")
async def get_all_users(
    page: int = 1,
    page_size: int = 10,
    q: Optional[str] = None,
    session: dict = Depends(verify_admin_session),
):
    """Get paginated users from Supabase"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        offset = (page - 1) * page_size

        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles"

        params = {
            "select": "*",
            "limit": page_size,
            "offset": offset,
            "order": "created_at.desc",
        }

        if q:
            term = f"%{q}%"
            params["or"] = f"email.ilike.{term},full_name.ilike.{term},id.ilike.{term}"
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.get(
                rest_url,
                params=params,
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "count=exact",
                },
            )
            
            if resp.status_code == 200:
                users = resp.json()
                content_range = resp.headers.get("content-range", "")
                total_count = None
                if "/" in content_range:
                    try:
                        total_count = int(content_range.split("/")[-1])
                    except ValueError:
                        total_count = None
                if total_count is None:
                    total_count = len(users)

                return {
                    "success": True,
                    "users": users,
                    "count": len(users),
                    "total": total_count,
                    "page": page,
                    "page_size": page_size,
                }
            else:
                raise HTTPException(status_code=500, detail=f"Failed to fetch users: {resp.text}")
                
    except Exception as e:
        logger.error(f"Admin get users error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/users/{user_id}")
async def get_user(user_id: str, session: dict = Depends(verify_admin_session)):
    """Get user details by ID"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?id=eq.{user_id}&select=*"
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.get(
                rest_url,
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                },
            )
            
            if resp.status_code == 200:
                users = resp.json()
                if users:
                    return {"success": True, "user": users[0]}
                else:
                    raise HTTPException(status_code=404, detail="User not found")
            else:
                raise HTTPException(status_code=500, detail=f"Failed to fetch user: {resp.text}")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin get user error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.put("/users/{user_id}")
async def update_user(user_id: str, update_data: UserUpdateRequest, session: dict = Depends(verify_admin_session)):
    """Update user credits or subscription"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        payload = {}
        if update_data.credits is not None:
            payload["credits"] = update_data.credits
        if update_data.subscription_tier is not None:
            payload["subscription_tier"] = update_data.subscription_tier
        if update_data.subscription_status is not None:
            payload["subscription_status"] = update_data.subscription_status
        
        if not payload:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?id=eq.{user_id}"
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.patch(
                rest_url,
                json=payload,
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
            )
            
            if resp.status_code in [200, 204]:
                updated_users = resp.json() if resp.content else []
                return {"success": True, "user": updated_users[0] if updated_users else None}
            else:
                raise HTTPException(status_code=500, detail=f"Failed to update user: {resp.text}")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin update user error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.delete("/users/{user_id}")
async def delete_user(user_id: str, session: dict = Depends(verify_admin_session)):
    """Delete user (soft delete by setting subscription_status to 'deleted')"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?id=eq.{user_id}"
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.patch(
                rest_url,
                json={"subscription_status": "deleted"},
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                },
            )
            
            if resp.status_code in [200, 204]:
                return {"success": True, "message": "User marked as deleted"}
            else:
                raise HTTPException(status_code=500, detail=f"Failed to delete user: {resp.text}")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin delete user error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/images")
async def get_all_images(session: dict = Depends(verify_admin_session), bucket: str = "wardrobe"):
    """Get all images from a storage bucket"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # List all files in bucket
        files = supabase.storage.from_(bucket).list()
        
        images = []
        for file in files:
            if file.name.endswith(('_full.jpg', '_thumb.jpg', '.jpg', '.png', '.jpeg')):
                public_url = supabase.storage.from_(bucket).get_public_url(file.name)
                images.append({
                    "name": file.name,
                    "url": public_url,
                    "size": file.metadata.get("size", 0) if hasattr(file, 'metadata') else 0,
                    "created_at": file.created_at if hasattr(file, 'created_at') else None,
                })
        
        return {"success": True, "images": images, "count": len(images), "bucket": bucket}
        
    except Exception as e:
        logger.error(f"Admin get images error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.delete("/images")
async def delete_image(session: dict = Depends(verify_admin_session), bucket: str = "wardrobe", path: str = None):
    """Delete an image from storage"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    if not path:
        raise HTTPException(status_code=400, detail="Path parameter is required")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        result = supabase.storage.from_(bucket).remove([path])
        
        if getattr(result, "error", None):
            raise HTTPException(status_code=500, detail=f"Failed to delete image: {result.error}")
        
        return {"success": True, "message": f"Image {path} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin delete image error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/stats")
async def get_stats(session: dict = Depends(verify_admin_session)):
    """Get admin dashboard statistics"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Get user stats
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?select=id,subscription_tier,credits,created_at"
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.get(
                rest_url,
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                },
            )
            
            if resp.status_code == 200:
                users = resp.json()
                
                # Calculate stats
                total_users = len(users) if isinstance(users, list) else 0
                # subscription_status kolonu yok; aktif kullanıcıyı toplam olarak raporla
                active_users = total_users
                free_users = len([u for u in users if isinstance(u, dict) and u.get("subscription_tier") == "free"]) if isinstance(users, list) else 0
                premium_users = len([u for u in users if isinstance(u, dict) and u.get("subscription_tier") == "premium"]) if isinstance(users, list) else 0
                total_credits = sum(u.get("credits", 0) for u in users if isinstance(u, dict)) if isinstance(users, list) else 0
                
                # Get image counts - hata durumunda 0 döndür
                wardrobe_count = 0
                profile_count = 0
                try:
                    wardrobe_files = supabase.storage.from_("wardrobe").list()
                    if wardrobe_files:
                        wardrobe_count = len([f for f in wardrobe_files if hasattr(f, 'name') and f.name.endswith(('_full.jpg', '.jpg', '.png', '.jpeg'))])
                except Exception as e:
                    logger.warning(f"Failed to get wardrobe files: {str(e)}")
                    wardrobe_count = 0
                
                try:
                    profile_files = supabase.storage.from_("profiles").list()
                    if profile_files:
                        profile_count = len([f for f in profile_files if hasattr(f, 'name') and f.name.endswith(('.jpg', '.png', '.jpeg'))])
                except Exception as e:
                    logger.warning(f"Failed to get profile files: {str(e)}")
                    profile_count = 0
                
                return {
                    "success": True,
                    "stats": {
                        "users": {
                            "total": total_users,
                            "active": active_users,
                            "free": free_users,
                            "premium": premium_users,
                        },
                        "credits": {
                            "total": total_credits,
                            "average": round(total_credits / total_users, 2) if total_users > 0 else 0,
                        },
                        "images": {
                            "wardrobe": wardrobe_count,
                            "profiles": profile_count,
                        },
                    }
                }
            else:
                error_detail = resp.text[:200] if resp.text else "Unknown error"
                logger.error(f"Failed to fetch users: {resp.status_code} - {error_detail}")
                raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {error_detail}")
                
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Admin get stats error: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Stats error: {error_msg}")

@admin_router.post("/notifications/send")
async def send_notification(request: NotificationRequest, session: dict = Depends(verify_admin_session)):
    """Send push notification to users"""
    try:
        logger.info(
            f"Admin notification request from {session.get('email')}: title={request.title}, body={request.body}, user_id={request.user_id}"
        )

        tokens_info = await fetch_push_tokens_from_supabase(request.user_id)

        if not tokens_info:
            raise HTTPException(status_code=404, detail="Gönderilecek push token bulunamadı")

        # Token bilgilerini log için hazırla
        tokens_summary = [
            {
                "token": item["token"][:20] + "..." if len(item["token"]) > 20 else item["token"],
                "platform": item.get("platform", "unknown"),
                "user_id": item.get("user_id"),
                "is_expo": item.get("is_expo", False),
                "is_fcm": item.get("is_fcm", False)
            }
            for item in tokens_info
        ]

        result = await send_expo_push_notifications(tokens_info, request.title, request.body, request.data)

        sent_count = len(result.get("sent", []))
        failed = result.get("failed", [])
        error_msgs = result.get("errors", [])

        # Push notification'ı logla
        await log_push_notification(
            title=request.title,
            body=request.body,
            target_user_id=request.user_id,
            sent_count=sent_count,
            failed_count=len(failed),
            tokens_info=tokens_summary,
            errors=error_msgs
        )

        if failed or error_msgs:
            logger.warning(
                f"Push notification partial failures - sent: {sent_count}, failed: {len(failed)}, errors: {error_msgs}"
            )

        return {
            "success": len(failed) == 0,
            "message": f"{sent_count} bildirim gönderildi, {len(failed)} başarısız",
            "sent": sent_count,
            "failed": failed,
            "errors": error_msgs,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin send notification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.get("/notifications/logs")
async def get_notification_logs(
    session: dict = Depends(verify_admin_session),
    page: int = 1,
    page_size: int = 20,
    limit: int = 100
):
    """Push notification loglarını getir"""
    try:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)
        limit = max(min(limit, 1000), 1)
        skip = (page - 1) * page_size

        # MongoDB'den logları getir
        cursor = db.push_notification_logs.find().sort("created_at", -1).skip(skip).limit(page_size)
        logs = await cursor.to_list(length=page_size)
        
        # Toplam sayıyı al
        total_count = await db.push_notification_logs.count_documents({})

        # ObjectId'leri string'e çevir
        for log in logs:
            if "_id" in log:
                log["id"] = str(log["_id"])
                del log["_id"]
            if "created_at" in log and isinstance(log["created_at"], datetime):
                log["created_at"] = log["created_at"].isoformat()
            if "timestamp" in log and isinstance(log["timestamp"], datetime):
                log["timestamp"] = log["timestamp"].isoformat()

        return {
            "success": True,
            "logs": logs,
            "count": len(logs),
            "total": total_count,
            "page": page,
            "page_size": page_size,
        }
    except Exception as e:
        logger.error(f"Admin get notification logs error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@admin_router.post("/logout")
async def admin_logout(session: dict = Depends(verify_admin_session), x_admin_token: str = Header(..., alias="X-Admin-Token")):
    """Admin logout endpoint"""
    admin_sessions.pop(x_admin_token, None)
    return {"success": True, "message": "Logged out successfully"}

# Include admin router
app.include_router(admin_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
