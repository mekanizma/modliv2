from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
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
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <title>Şifre Sıfırla • Modli</title>
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
      </div>

      <main class="card" aria-labelledby="headline">
        <div class="card-inner">
          <div class="chip-row">
            <div class="chip">
              <span class="chip-dot"></span>
              Güvenli şifre sıfırlama
            </div>
            <div class="chip">Web • iOS • Android</div>
          </div>

          <h1 id="headline" class="headline">Yeni şifreni belirle</h1>
          <p class="subcopy">
            E-posta adresine gönderdiğimiz bağlantı üzerinden geldin.
            Güvenlik için buradan yeni Modli şifreni oluşturabilirsin.
          </p>

          <form id="resetForm" novalidate>
            <div class="field">
              <label for="password">Yeni şifre</label>
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
                  placeholder="En az 6 karakter"
                  required
                />
                <button
                  class="toggle-btn"
                  type="button"
                  id="toggleVisibility"
                  aria-label="Şifreyi göster veya gizle"
                >
                  GÖSTER
                </button>
              </div>
              <p class="hint">
                En iyi güvenlik için; en az 1 rakam, 1 harf ve 1 özel karakter öneriyoruz.
              </p>
            </div>

            <div class="field">
              <label for="confirm">Şifreyi tekrar yaz</label>
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
                  placeholder="Tekrar yeni şifre"
                  required
                />
              </div>
            </div>

            <p id="error" class="error-text" role="alert" style="display: none;"></p>

            <div class="submit">
              <button id="submitBtn" type="submit" class="btn-primary">
                Şifreyi güncelle
              </button>
              <button
                type="button"
                class="btn-secondary"
                onclick="window.location.href='https://modli.app'">
                Uygulamaya geri dön
              </button>
            </div>

            <div class="badge-row" aria-live="polite" aria-atomic="true">
              <div class="made-for">
                <span class="pill">Geri dönüşümlü gardırop</span>
              </div>
              <div class="status-pill" id="linkStatus">
                <span class="status-dot"></span>
                <span class="status-text status-warn">
                  Bağlantı doğrulanıyor…
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

      let accessToken = null;

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
        textSpan.textContent = text;
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
        try {{
          const {{ access_token, type }} = parseHash();
          if (!access_token) {{
            setStatus(
              "error",
              "Bağlantı geçersiz veya süresi dolmuş. Lütfen yeniden şifre sıfırlama iste."
            );
            submitBtn.disabled = true;
            return;
          }}
          if (type && type !== "recovery") {{
            setStatus(
              "warn",
              "Farklı bir bağlantı türü algılandı. Yine de devam edebilirsin."
            );
          }} else {{
            setStatus("ok", "Bağlantın doğrulandı. Yeni şifreni belirleyebilirsin.");
          }}
          accessToken = access_token;
        }} catch (e) {{
          console.error(e);
          setStatus(
            "error",
            "Bağlantı okunamadı. Lütfen e-postandaki linke tekrar tıkla."
          );
          submitBtn.disabled = true;
        }}
      }})();

      toggleBtn.addEventListener("click", () => {{
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        confirmInput.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "GİZLE" : "GÖSTER";
      }});

      form.addEventListener("submit", async (event) => {{
        event.preventDefault();
        clearError();

        if (!accessToken) {{
          showError(
            "Geçersiz bağlantı. Lütfen e-posta kutundan yeni bir şifre sıfırlama iste."
          );
          return;
        }}

        const password = passwordInput.value.trim();
        const confirm = confirmInput.value.trim();

        if (!password || !confirm) {{
          showError("Lütfen tüm alanları doldur.");
          return;
        }}
        if (password.length < 6) {{
          showError("Şifre en az 6 karakter olmalı.");
          return;
        }}
        if (password !== confirm) {{
          showError("Şifreler birbiriyle eşleşmiyor.");
          return;
        }}

        submitBtn.disabled = true;
        submitBtn.textContent = "Güncelleniyor…";

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
              "Şifre güncellenemedi. Lütfen bağlantıyı tekrar deneyin.";
            showError(msg);
            submitBtn.disabled = false;
            submitBtn.textContent = "Şifreyi güncelle";
            return;
          }}

          setStatus("ok", "Şifren başarıyla güncellendi.");
          alert(
            "Şifren güncellendi. Artık Modli uygulamasına yeni şifrenle giriş yapabilirsin."
          );
          window.location.href = "https://modli.app";
        }} catch (err) {{
          console.error(err);
          showError("Bir hata oluştu. Lütfen birkaç dakika sonra tekrar dene.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Şifreyi güncelle";
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
                http_client,
                request.user_id
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
async def upload_image(
    file: UploadFile = File(...),
    bucket: str = Form("wardrobe"),
    user_id: str = Form(...),
    filename: Optional[str] = Form(None),
):
    """
    Upload image to Supabase Storage and create thumbnail
    Returns URLs for both full and thumbnail images
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        image_bytes = await file.read()
        
        # Create thumbnail
        thumbnail_bytes = create_thumbnail(image_bytes, size=(300, 300))
        
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
async def get_all_users(session: dict = Depends(verify_admin_session)):
    """Get all users from Supabase"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Get all profiles
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?select=*"
        
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
                return {"success": True, "users": users, "count": len(users)}
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
        rest_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/profiles?select=id,subscription_tier,subscription_status,credits,created_at"
        
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
                active_users = len([u for u in users if isinstance(u, dict) and u.get("subscription_status") == "active"]) if isinstance(users, list) else 0
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
    # Note: This is a placeholder. In production, you'd integrate with Expo Push Notification service
    # or Firebase Cloud Messaging
    
    try:
        # For now, return success. In production, implement actual push notification sending
        # You would need to:
        # 1. Get user push tokens from database
        # 2. Send notifications via Expo Push API or FCM
        # 3. Handle errors and retries
        
        logger.info(f"Admin notification request from {session.get('email')}: title={request.title}, body={request.body}, user_id={request.user_id}")
        
        return {
            "success": True,
            "message": "Notification queued (implementation needed)",
            "notification": {
                "title": request.title,
                "body": request.body,
                "user_id": request.user_id,
                "data": request.data,
            }
        }
        
    except Exception as e:
        logger.error(f"Admin send notification error: {str(e)}")
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
