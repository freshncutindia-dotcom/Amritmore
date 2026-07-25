import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal

import jwt
from bcrypt import hashpw, gensalt, checkpw
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET_KEY"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
JWT_ALGO = "HS256"
JWT_EXPIRE_HOURS = 24 * 7

# Product schema/seed version. Bump to force reseed on schema changes.
SEED_VERSION = 3

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="FreshCuts API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("freshcuts")


# ================= MODELS =================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str
    name: str


class UserOut(BaseModel):
    email: str
    name: str
    role: str


class ProductIn(BaseModel):
    name: str
    description: str
    category: Literal["cut-veg", "cut-fruit", "whole", "ready-mix"]
    cut_type: str = "whole"
    price: float
    unit: str = "500g"
    image: str
    stock: int = 100
    tags: List[str] = []
    available_cuts: List[str] = ["whole"]
    available_weights: List[str] = ["500g"]


class Product(ProductIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PincodeIn(BaseModel):
    pincode: str
    area: str
    delivery_fee: float = 0.0
    eta_hours: int = 3


class Pincode(PincodeIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    cut_type: str
    unit: str
    image: str


class OrderIn(BaseModel):
    items: List[OrderItem]
    address: str
    pincode: str
    phone: str
    payment_method: Literal["cod", "stripe"] = "cod"
    delivery_fee: float = 0.0
    subtotal: float
    total: float


class Order(OrderIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_email: str
    status: Literal["pending", "paid", "confirmed", "packed", "out-for-delivery", "delivered", "cancelled"] = "pending"
    payment_status: Literal["pending", "paid", "failed"] = "pending"
    stripe_session_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CheckoutSessionIn(BaseModel):
    order_id: str
    origin_url: str


# ============== AUTH HELPERS ==============
def hash_pw(pw: str) -> str:
    return hashpw(pw.encode("utf-8"), gensalt()).decode("utf-8")


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(email: str, role: str) -> str:
    payload = {
        "sub": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    email = payload.get("sub")
    user = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


# ============== ROUTES ==============
@api.get("/")
async def root():
    return {"message": "FreshCuts API is running", "version": "1.0"}


@api.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "email": email,
        "name": body.name,
        "password_hash": hash_pw(body.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_token(email, "user")
    return TokenOut(access_token=token, role="user", email=email, name=body.name)


@api.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    token = create_token(email, user.get("role", "user"))
    return TokenOut(access_token=token, role=user.get("role", "user"), email=email, name=user.get("name", ""))


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return UserOut(email=user["email"], name=user.get("name", ""), role=user.get("role", "user"))


# --- Products ---
@api.get("/products", response_model=List[Product])
async def list_products(category: Optional[str] = None, cut_type: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
    if cut_type and cut_type != "all":
        query["available_cuts"] = cut_type
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).to_list(500)
    return [Product(**d) for d in docs]


@api.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Product not found")
    return Product(**doc)


@api.post("/products", response_model=Product)
async def create_product(body: ProductIn, _=Depends(require_admin)):
    product = Product(**body.dict())
    doc = product.dict()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.products.insert_one(doc)
    return product


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, _=Depends(require_admin)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"ok": True}


# --- Pincodes ---
@api.get("/pincodes", response_model=List[Pincode])
async def list_pincodes():
    docs = await db.pincodes.find({}, {"_id": 0}).to_list(500)
    return [Pincode(**d) for d in docs]


@api.get("/pincodes/check/{pincode}")
async def check_pincode(pincode: str):
    doc = await db.pincodes.find_one({"pincode": pincode}, {"_id": 0})
    if not doc:
        return {"serviceable": False, "message": "Sorry, we don't deliver to this pincode yet."}
    return {"serviceable": True, **doc}


@api.post("/pincodes", response_model=Pincode)
async def add_pincode(body: PincodeIn, _=Depends(require_admin)):
    if await db.pincodes.find_one({"pincode": body.pincode}):
        raise HTTPException(400, "Pincode already exists")
    pc = Pincode(**body.dict())
    await db.pincodes.insert_one(pc.dict())
    return pc


@api.delete("/pincodes/{pincode}")
async def del_pincode(pincode: str, _=Depends(require_admin)):
    await db.pincodes.delete_one({"pincode": pincode})
    return {"ok": True}


# --- Orders ---
@api.post("/orders", response_model=Order)
async def create_order(body: OrderIn, user=Depends(get_current_user)):
    pc = await db.pincodes.find_one({"pincode": body.pincode})
    if not pc:
        raise HTTPException(400, "Pincode not serviceable")
    order = Order(user_email=user["email"], **body.dict())
    doc = order.dict()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.orders.insert_one(doc)
    return order


@api.get("/orders", response_model=List[Order])
async def my_orders(user=Depends(get_current_user)):
    docs = await db.orders.find({"user_email": user["email"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Order(**d) for d in docs]


@api.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user=Depends(get_current_user)):
    doc = await db.orders.find_one({"id": order_id, "user_email": user["email"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Order not found")
    return Order(**doc)


# --- Stripe Checkout via emergentintegrations ---
@api.post("/payments/checkout")
async def create_checkout(body: CheckoutSessionIn, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": body.order_id, "user_email": user["email"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(400, "Order already paid")

    origin = body.origin_url.rstrip("/")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    req = CheckoutSessionRequest(
        amount=float(order["total"]),
        currency="inr",
        success_url=f"{origin}/api/payments/success?order_id={body.order_id}&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/api/payments/cancel?order_id={body.order_id}",
        metadata={"order_id": body.order_id, "user_email": user["email"]},
    )
    try:
        session = await stripe_checkout.create_checkout_session(req)
    except Exception as e:
        logger.exception("Stripe error")
        raise HTTPException(500, f"Stripe error: {str(e)}")

    await db.orders.update_one(
        {"id": body.order_id},
        {"$set": {"stripe_session_id": session.session_id}},
    )
    return {"url": session.url, "session_id": session.session_id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user=Depends(get_current_user)):
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(500, f"Stripe error: {str(e)}")
    paid = status.payment_status == "paid"
    order_id = (status.metadata or {}).get("order_id")
    if paid and order_id:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"payment_status": "paid", "status": "confirmed"}},
        )
    return {"paid": paid, "payment_status": status.payment_status, "status": status.status, "order_id": order_id}


@api.get("/payments/success")
async def payment_success(order_id: str, session_id: str):
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        if status.payment_status == "paid":
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"payment_status": "paid", "status": "confirmed"}},
            )
    except Exception:
        pass
    return {"ok": True, "order_id": order_id, "message": "Payment successful. You can return to the app."}


@api.get("/payments/cancel")
async def payment_cancel(order_id: str):
    return {"ok": False, "order_id": order_id, "message": "Payment cancelled."}


app.include_router(api)


# ============== SEED DATA ==============
# Each product represents ONE vegetable/fruit with configurable weight & cut choices.
STANDARD_WEIGHTS = ["250g", "500g", "1kg"]
ALL_CUTS = ["sliced", "diced", "shredded", "batonnet", "cubed", "grated", "julienne"]

SEED_PRODUCTS = [
    # ---- Whole vegetables ----
    {"name": "Roma Tomatoes", "description": "Sun-ripened plum tomatoes — perfect for sauces, salads and cooking.", "category": "whole", "cut_type": "whole", "price": 45, "unit": "500g", "image": "https://images.unsplash.com/photo-1546470427-e5380b6d1cf6?w=600&q=80", "tags": ["fresh", "organic"], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Yellow Onions", "description": "Locally sourced onions with strong flavor — kitchen essential.", "category": "whole", "cut_type": "whole", "price": 35, "unit": "500g", "image": "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=600&q=80", "tags": ["essential"], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Baby Potatoes", "description": "Small, thin-skinned potatoes — perfect for roasting.", "category": "whole", "cut_type": "whole", "price": 55, "unit": "1kg", "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", "tags": ["essential"], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Farm Broccoli", "description": "Deep-green crowns, hand-picked this morning.", "category": "whole", "cut_type": "whole", "price": 89, "unit": "500g", "image": "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&q=80", "tags": ["organic"], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Baby Spinach", "description": "Tender leafy greens, tripled-washed.", "category": "whole", "cut_type": "whole", "price": 39, "unit": "250g", "image": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80", "tags": ["leafy"], "available_cuts": ["whole"], "available_weights": ["250g", "500g"]},
    {"name": "Red Bell Peppers", "description": "Crunchy, sweet capsicum from local farms.", "category": "whole", "cut_type": "whole", "price": 65, "unit": "500g", "image": "https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=600&q=80", "tags": ["colorful"], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Purple Cabbage", "description": "Crispy heads with vibrant color for slaws.", "category": "whole", "cut_type": "whole", "price": 55, "unit": "1kg", "image": "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&q=80", "tags": [], "available_cuts": ["whole"], "available_weights": ["500g", "1kg"]},
    {"name": "Rainbow Carrots", "description": "A colorful trio — orange, purple & yellow.", "category": "whole", "cut_type": "whole", "price": 79, "unit": "500g", "image": "https://images.unsplash.com/photo-1447175008436-054170c2e979?w=600&q=80", "tags": ["colorful"], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Cauliflower", "description": "Firm white heads — great for curries and roasts.", "category": "whole", "cut_type": "whole", "price": 49, "unit": "1kg", "image": "https://images.unsplash.com/photo-1568584711271-6c929fb49b60?w=600&q=80", "tags": [], "available_cuts": ["whole"], "available_weights": ["500g", "1kg"]},
    # Whole fruits
    {"name": "Alphonso Mangoes", "description": "The king of mangoes — buttery & aromatic.", "category": "whole", "cut_type": "whole", "price": 349, "unit": "1kg", "image": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80", "tags": ["seasonal", "premium"], "available_cuts": ["whole"], "available_weights": ["500g", "1kg"]},
    {"name": "Fuji Apples", "description": "Crisp bite, high-altitude grown.", "category": "whole", "cut_type": "whole", "price": 199, "unit": "1kg", "image": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80", "tags": [], "available_cuts": ["whole"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Kiwi Fruit", "description": "Zespri golden kiwis, tangy & sweet.", "category": "whole", "cut_type": "whole", "price": 189, "unit": "500g", "image": "https://images.unsplash.com/photo-1585059895524-72359e06133a?w=600&q=80", "tags": ["vitamin-c"], "available_cuts": ["whole"], "available_weights": ["250g", "500g"]},
    {"name": "Dragon Fruit", "description": "Exotic pink flesh, subtle sweetness.", "category": "whole", "cut_type": "whole", "price": 129, "unit": "500g", "image": "https://images.unsplash.com/photo-1527325678964-54921661f888?w=600&q=80", "tags": ["exotic"], "available_cuts": ["whole"], "available_weights": ["250g", "500g"]},
    {"name": "Strawberries", "description": "Handpicked from Mahabaleshwar hills.", "category": "whole", "cut_type": "whole", "price": 149, "unit": "250g", "image": "https://images.unsplash.com/photo-1543528176-61b239494933?w=600&q=80", "tags": ["seasonal"], "available_cuts": ["whole"], "available_weights": ["250g", "500g"]},

    # ---- Pre-cut vegetables (one product per vegetable, multiple cut choices) ----
    {"name": "Onions", "description": "Choose your cut — sliced for salads, diced for tempering, or grated for masala.", "category": "cut-veg", "cut_type": "diced", "price": 59, "unit": "250g", "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", "tags": ["prep-ready"], "available_cuts": ["sliced", "diced", "shredded", "grated"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Potatoes", "description": "Peeled and cut as you like — cubed for curries, batonnet for fries.", "category": "cut-veg", "cut_type": "cubed", "price": 55, "unit": "500g", "image": "https://images.unsplash.com/photo-1567374783966-4a4a2b0d2b91?w=600&q=80", "tags": ["ready-to-cook"], "available_cuts": ["cubed", "sliced", "batonnet", "diced"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Carrots", "description": "Peeled & cut to your preference.", "category": "cut-veg", "cut_type": "batonnet", "price": 69, "unit": "250g", "image": "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600&q=80", "tags": ["chef-cut"], "available_cuts": ["batonnet", "diced", "julienne", "grated"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Cabbage", "description": "Freshly shredded or diced — for tacos, salads and stir-fry.", "category": "cut-veg", "cut_type": "shredded", "price": 49, "unit": "250g", "image": "https://images.unsplash.com/photo-1571168290120-ee27fbdb3fe0?w=600&q=80", "tags": [], "available_cuts": ["shredded", "sliced", "diced"], "available_weights": STANDARD_WEIGHTS},
    {"name": "Bell Peppers", "description": "Multi-color capsicum — julienne, diced or sliced.", "category": "cut-veg", "cut_type": "julienne", "price": 79, "unit": "250g", "image": "https://images.unsplash.com/photo-1598295309854-cfa5819004d8?w=600&q=80", "tags": ["colorful"], "available_cuts": ["julienne", "diced", "sliced"], "available_weights": ["250g", "500g"]},
    {"name": "Beetroot", "description": "Grated or cubed — vibrant, antioxidant-rich.", "category": "cut-veg", "cut_type": "grated", "price": 65, "unit": "250g", "image": "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600&q=80", "tags": ["antioxidant"], "available_cuts": ["grated", "cubed", "sliced"], "available_weights": ["250g", "500g"]},
    {"name": "Cauliflower Florets", "description": "Pre-cut florets, ready to cook.", "category": "cut-veg", "cut_type": "diced", "price": 59, "unit": "250g", "image": "https://images.unsplash.com/photo-1568584711271-6c929fb49b60?w=600&q=80", "tags": ["ready-to-cook"], "available_cuts": ["diced"], "available_weights": ["250g", "500g"]},
    {"name": "Green Beans", "description": "French-cut or chopped — sauté-ready.", "category": "cut-veg", "cut_type": "sliced", "price": 79, "unit": "250g", "image": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=600&q=80", "tags": [], "available_cuts": ["sliced", "julienne"], "available_weights": ["250g", "500g"]},

    # ---- Pre-cut fruits ----
    {"name": "Mango", "description": "Sweet mango — diced cubes or sliced strips, chilled & ready.", "category": "cut-fruit", "cut_type": "diced", "price": 199, "unit": "250g", "image": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80", "tags": ["ready-to-eat"], "available_cuts": ["diced", "sliced", "cubed"], "available_weights": ["250g", "500g"]},
    {"name": "Pineapple", "description": "Golden rings, cored & ready.", "category": "cut-fruit", "cut_type": "sliced", "price": 129, "unit": "500g", "image": "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&q=80", "tags": ["ready-to-eat"], "available_cuts": ["sliced", "cubed", "diced"], "available_weights": ["250g", "500g"]},
    {"name": "Watermelon", "description": "Seedless watermelon, hydrating cubes.", "category": "cut-fruit", "cut_type": "cubed", "price": 99, "unit": "500g", "image": "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=600&q=80", "tags": ["hydrating"], "available_cuts": ["cubed", "sliced"], "available_weights": ["500g", "1kg"]},
    {"name": "Papaya", "description": "Ripe papaya, digestive friendly cuts.", "category": "cut-fruit", "cut_type": "cubed", "price": 89, "unit": "500g", "image": "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=600&q=80", "tags": [], "available_cuts": ["cubed", "sliced", "diced"], "available_weights": ["250g", "500g"]},
    {"name": "Mixed Fruit Bowl", "description": "Watermelon, papaya, kiwi & mango — cubed.", "category": "cut-fruit", "cut_type": "cubed", "price": 179, "unit": "500g", "image": "https://images.unsplash.com/photo-1490474504059-bf2db5ab2348?w=600&q=80", "tags": ["mixed", "healthy"], "available_cuts": ["cubed"], "available_weights": ["250g", "500g"]},

    # ---- Ready-to-cook mixes ----
    {"name": "Stir-fry Mix", "description": "Bell peppers, baby corn, broccoli & carrots — wok-ready.", "category": "ready-mix", "cut_type": "mix", "price": 149, "unit": "300g", "image": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80", "tags": ["quick-meal", "wok"], "available_cuts": ["mix"], "available_weights": ["300g", "500g"]},
    {"name": "Biryani Veggie Mix", "description": "Beans, carrots, cauliflower & peas — biryani-ready.", "category": "ready-mix", "cut_type": "mix", "price": 129, "unit": "300g", "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80", "tags": ["indian", "quick-meal"], "available_cuts": ["mix"], "available_weights": ["300g", "500g"]},
    {"name": "Soup Base Mix", "description": "Celery, leeks, carrots, garlic & herbs.", "category": "ready-mix", "cut_type": "mix", "price": 109, "unit": "250g", "image": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80", "tags": ["comfort"], "available_cuts": ["mix"], "available_weights": ["250g", "500g"]},
    {"name": "Curry Cut Mix", "description": "Onion, tomato, ginger-garlic — cut for curry.", "category": "ready-mix", "cut_type": "mix", "price": 89, "unit": "300g", "image": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80", "tags": ["indian", "quick-meal"], "available_cuts": ["mix"], "available_weights": ["300g", "500g"]},
    {"name": "Salad Bowl Mix", "description": "Lettuce, cherry tomatoes, cucumber, olives.", "category": "ready-mix", "cut_type": "mix", "price": 159, "unit": "250g", "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80", "tags": ["healthy", "no-cook"], "available_cuts": ["mix"], "available_weights": ["250g", "500g"]},
    {"name": "Pav Bhaji Mix", "description": "Potato, cauliflower, peas, capsicum — bhaji-ready.", "category": "ready-mix", "cut_type": "mix", "price": 119, "unit": "500g", "image": "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&q=80", "tags": ["indian", "street-food"], "available_cuts": ["mix"], "available_weights": ["500g", "1kg"]},
]

SEED_PINCODES = [
    {"pincode": "560001", "area": "Bengaluru Central", "delivery_fee": 0, "eta_hours": 2},
    {"pincode": "560034", "area": "Koramangala", "delivery_fee": 0, "eta_hours": 2},
    {"pincode": "560076", "area": "BTM Layout", "delivery_fee": 25, "eta_hours": 3},
    {"pincode": "560103", "area": "Bellandur", "delivery_fee": 25, "eta_hours": 3},
    {"pincode": "400001", "area": "Mumbai Fort", "delivery_fee": 30, "eta_hours": 4},
    {"pincode": "400050", "area": "Bandra West", "delivery_fee": 30, "eta_hours": 4},
    {"pincode": "110001", "area": "New Delhi Central", "delivery_fee": 40, "eta_hours": 5},
    {"pincode": "110016", "area": "Hauz Khas", "delivery_fee": 40, "eta_hours": 5},
]


@app.on_event("startup")
async def seed_database():
    # Seed admin
    if not await db.users.find_one({"email": ADMIN_EMAIL.lower()}):
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(),
            "name": "FreshCuts Admin",
            "password_hash": hash_pw(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user")

    # Re-seed products whenever SEED_VERSION changes
    meta = await db.meta.find_one({"key": "seed_version"})
    current_version = meta.get("value") if meta else None
    if current_version != SEED_VERSION:
        await db.products.delete_many({})
        for p in SEED_PRODUCTS:
            product = Product(**p)
            doc = product.dict()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.products.insert_one(doc)
        await db.meta.update_one({"key": "seed_version"}, {"$set": {"value": SEED_VERSION}}, upsert=True)
        logger.info(f"Reseeded {len(SEED_PRODUCTS)} products (schema v{SEED_VERSION})")

    if await db.pincodes.count_documents({}) == 0:
        for p in SEED_PINCODES:
            pc = Pincode(**p)
            await db.pincodes.insert_one(pc.dict())
        logger.info(f"Seeded {len(SEED_PINCODES)} pincodes")


@app.on_event("shutdown")
async def shutdown():
    client.close()
