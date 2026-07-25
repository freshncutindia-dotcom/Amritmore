import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal

import jwt
import stripe
from bcrypt import hashpw, gensalt, checkpw
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

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

stripe.api_key = STRIPE_API_KEY

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
    category: Literal["whole-veg", "whole-fruit", "cut-veg", "cut-fruit"]
    cut_type: Literal["whole", "sliced", "diced", "shredded", "batonnet", "cubed", "grated", "julienne"] = "whole"
    price: float
    unit: str = "500g"
    image: str
    stock: int = 100
    tags: List[str] = []


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
    if category:
        query["category"] = category
    if cut_type and cut_type != "all":
        query["cut_type"] = cut_type
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
    # Validate pincode
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


# --- Stripe Checkout ---
@api.post("/payments/checkout")
async def create_checkout(body: CheckoutSessionIn, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": body.order_id, "user_email": user["email"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") == "paid":
        raise HTTPException(400, "Order already paid")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "quantity": item["quantity"],
                    "price_data": {
                        "currency": "inr",
                        "unit_amount": int(round(item["price"] * 100)),
                        "product_data": {"name": f"{item['name']} ({item['cut_type']}, {item['unit']})"},
                    },
                }
                for item in order["items"]
            ] + ([
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": "inr",
                        "unit_amount": int(round(order["delivery_fee"] * 100)),
                        "product_data": {"name": "Delivery Fee"},
                    },
                }
            ] if order.get("delivery_fee", 0) > 0 else []),
            success_url=f"{body.origin_url}/checkout/success?order_id={body.order_id}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{body.origin_url}/checkout/cancel?order_id={body.order_id}",
            metadata={"order_id": body.order_id, "user_email": user["email"]},
        )
        await db.orders.update_one(
            {"id": body.order_id},
            {"$set": {"stripe_session_id": session.id}},
        )
        return {"url": session.url, "session_id": session.id}
    except stripe.StripeError as e:
        logger.exception("Stripe error")
        raise HTTPException(500, f"Stripe error: {str(e)}")


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user=Depends(get_current_user)):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.StripeError as e:
        raise HTTPException(500, f"Stripe error: {str(e)}")
    paid = session.payment_status == "paid"
    order_id = session.metadata.get("order_id") if session.metadata else None
    if paid and order_id:
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"payment_status": "paid", "status": "confirmed"}},
        )
    return {"paid": paid, "status": session.payment_status, "order_id": order_id}


app.include_router(api)


# ============== SEED DATA ==============
SEED_PRODUCTS = [
    # Whole vegetables
    {"name": "Roma Tomatoes", "description": "Sun-ripened plum tomatoes, perfect for sauces and salads.", "category": "whole-veg", "cut_type": "whole", "price": 45, "unit": "500g", "image": "https://images.unsplash.com/photo-1546470427-e5380b6d1cf6?w=600&q=80", "stock": 50, "tags": ["fresh", "organic"]},
    {"name": "Farm Broccoli", "description": "Deep-green crowns, hand-picked this morning.", "category": "whole-veg", "cut_type": "whole", "price": 89, "unit": "500g", "image": "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&q=80", "stock": 40, "tags": ["organic"]},
    {"name": "Baby Spinach", "description": "Tender leafy greens, tripled-washed.", "category": "whole-veg", "cut_type": "whole", "price": 39, "unit": "250g", "image": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80", "stock": 60, "tags": ["leafy"]},
    {"name": "Red Bell Peppers", "description": "Crunchy, sweet capsicum from local farms.", "category": "whole-veg", "cut_type": "whole", "price": 65, "unit": "500g", "image": "https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=600&q=80", "stock": 45, "tags": ["colorful"]},
    {"name": "Purple Cabbage", "description": "Crispy heads with vibrant color for slaws.", "category": "whole-veg", "cut_type": "whole", "price": 55, "unit": "1kg", "image": "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&q=80", "stock": 30, "tags": []},
    {"name": "Rainbow Carrots", "description": "A colorful trio — orange, purple & yellow.", "category": "whole-veg", "cut_type": "whole", "price": 79, "unit": "500g", "image": "https://images.unsplash.com/photo-1447175008436-054170c2e979?w=600&q=80", "stock": 40, "tags": ["colorful"]},

    # Cut vegetables
    {"name": "Diced Onions", "description": "Uniform 8mm dice — ready for tempering.", "category": "cut-veg", "cut_type": "diced", "price": 59, "unit": "250g", "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", "stock": 25, "tags": ["prep-ready"]},
    {"name": "Sliced Bell Peppers", "description": "Multi-color julienne cuts, ideal for stir-fry.", "category": "cut-veg", "cut_type": "sliced", "price": 79, "unit": "250g", "image": "https://images.unsplash.com/photo-1598295309854-cfa5819004d8?w=600&q=80", "stock": 30, "tags": ["ready-to-cook"]},
    {"name": "Shredded Cabbage", "description": "Finely shredded, perfect for tacos & slaws.", "category": "cut-veg", "cut_type": "shredded", "price": 49, "unit": "250g", "image": "https://images.unsplash.com/photo-1571168290120-ee27fbdb3fe0?w=600&q=80", "stock": 35, "tags": []},
    {"name": "Batonnet Carrots", "description": "Chef-cut 6cm batons, restaurant-style.", "category": "cut-veg", "cut_type": "batonnet", "price": 69, "unit": "250g", "image": "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600&q=80", "stock": 20, "tags": ["chef-cut"]},
    {"name": "Cubed Potatoes", "description": "1cm cubes, blanched & ready.", "category": "cut-veg", "cut_type": "cubed", "price": 55, "unit": "500g", "image": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80", "stock": 40, "tags": []},
    {"name": "Grated Beetroot", "description": "Coarse grated — great for salads & juices.", "category": "cut-veg", "cut_type": "grated", "price": 65, "unit": "250g", "image": "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600&q=80", "stock": 20, "tags": ["antioxidant"]},

    # Whole fruits
    {"name": "Alphonso Mangoes", "description": "The king of mangoes — buttery & aromatic.", "category": "whole-fruit", "cut_type": "whole", "price": 349, "unit": "1kg", "image": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&q=80", "stock": 25, "tags": ["seasonal", "premium"]},
    {"name": "Kiwi Fruit", "description": "Zespri golden kiwis, tangy & sweet.", "category": "whole-fruit", "cut_type": "whole", "price": 189, "unit": "500g", "image": "https://images.unsplash.com/photo-1585059895524-72359e06133a?w=600&q=80", "stock": 30, "tags": ["vitamin-c"]},
    {"name": "Fuji Apples", "description": "Crisp bite, high-altitude grown.", "category": "whole-fruit", "cut_type": "whole", "price": 199, "unit": "1kg", "image": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80", "stock": 40, "tags": []},
    {"name": "Dragon Fruit", "description": "Exotic pink flesh, subtle sweetness.", "category": "whole-fruit", "cut_type": "whole", "price": 129, "unit": "500g", "image": "https://images.unsplash.com/photo-1527325678964-54921661f888?w=600&q=80", "stock": 20, "tags": ["exotic"]},
    {"name": "Fresh Strawberries", "description": "Handpicked from Mahabaleshwar hills.", "category": "whole-fruit", "cut_type": "whole", "price": 149, "unit": "250g", "image": "https://images.unsplash.com/photo-1543528176-61b239494933?w=600&q=80", "stock": 35, "tags": ["seasonal"]},

    # Cut fruits
    {"name": "Diced Mango Cubes", "description": "Sweet mango, cubed & chilled.", "category": "cut-fruit", "cut_type": "diced", "price": 199, "unit": "250g", "image": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80", "stock": 15, "tags": ["ready-to-eat"]},
    {"name": "Sliced Pineapple", "description": "Golden rings, cored & ready.", "category": "cut-fruit", "cut_type": "sliced", "price": 129, "unit": "500g", "image": "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&q=80", "stock": 20, "tags": ["ready-to-eat"]},
    {"name": "Mixed Fruit Bowl", "description": "Watermelon, papaya, kiwi & mango.", "category": "cut-fruit", "cut_type": "cubed", "price": 179, "unit": "500g", "image": "https://images.unsplash.com/photo-1490474504059-bf2db5ab2348?w=600&q=80", "stock": 25, "tags": ["mixed", "healthy"]},
    {"name": "Watermelon Cubes", "description": "Seedless watermelon, hydrating cubes.", "category": "cut-fruit", "cut_type": "cubed", "price": 99, "unit": "500g", "image": "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=600&q=80", "stock": 30, "tags": ["hydrating"]},
    {"name": "Papaya Cubes", "description": "Ripe papaya cubes, digestive friendly.", "category": "cut-fruit", "cut_type": "cubed", "price": 89, "unit": "500g", "image": "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=600&q=80", "stock": 25, "tags": []},
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

    # Seed products
    if await db.products.count_documents({}) == 0:
        for p in SEED_PRODUCTS:
            product = Product(**p)
            doc = product.dict()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.products.insert_one(doc)
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")

    # Seed pincodes
    if await db.pincodes.count_documents({}) == 0:
        for p in SEED_PINCODES:
            pc = Pincode(**p)
            await db.pincodes.insert_one(pc.dict())
        logger.info(f"Seeded {len(SEED_PINCODES)} pincodes")


@app.on_event("shutdown")
async def shutdown():
    client.close()
