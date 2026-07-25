import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal, Dict

import jwt
from bcrypt import hashpw, gensalt, checkpw
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
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
SEED_VERSION = 13

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


class Recipe(BaseModel):
    title: str
    time_mins: int = 15
    servings: int = 2
    image: str
    ingredients: List[str] = []
    steps: List[str] = []


class ProductIn(BaseModel):
    name: str
    description: str
    category: Literal["cut-veg", "cut-fruit", "whole", "organic", "ready-mix"]
    cut_type: str = "whole"
    price: float
    unit: str = "500g"
    image: str
    stock: int = 100
    tags: List[str] = []
    available_cuts: List[str] = ["whole"]
    available_weights: List[str] = ["500g"]
    cut_images: Dict[str, str] = {}
    recipes: List[Recipe] = []
    sku: Optional[str] = None
    local_name: Optional[str] = None
    gallery: List[str] = []


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


# --- Subscription models ---
class SubscriptionIn(BaseModel):
    box_type: Literal["essentials", "mixed", "premium"]
    frequency: Literal["weekly", "biweekly"]
    delivery_day: str = "Monday"
    pincode: str
    address: str
    phone: str


class Subscription(SubscriptionIn):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_email: str
    status: Literal["active", "paused", "cancelled"] = "active"
    price_per_box: float
    box_name: str
    box_items: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    next_delivery: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=3))


BOXES: Dict[str, Dict] = {
    "essentials": {
        "name": "Essentials Box",
        "price": 599,
        "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80",
        "tag": "Save ₹120/box",
        "items": [
            "1kg Roma Tomatoes",
            "500g Yellow Onions",
            "1kg Baby Potatoes",
            "500g Rainbow Carrots",
            "1 Purple Cabbage",
            "250g Baby Spinach",
        ],
    },
    "mixed": {
        "name": "Mixed Veg + Fruits",
        "price": 999,
        "image": "https://images.unsplash.com/photo-1490474504059-bf2db5ab2348?w=800&q=80",
        "tag": "Most popular · Save ₹200/box",
        "items": [
            "500g Fuji Apples",
            "500g Alphonso Mango",
            "1 Pineapple",
            "1kg Tomatoes",
            "500g Bell Peppers",
            "1 Cauliflower",
            "500g Carrots",
        ],
    },
    "premium": {
        "name": "Premium Chef Box",
        "price": 1499,
        "image": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80",
        "tag": "Chef's pick · Save ₹350/box",
        "items": [
            "Pre-cut Onions (500g diced)",
            "Pre-cut Potatoes (500g cubed)",
            "Pre-cut Carrots (250g julienne)",
            "Pre-cut Bell Peppers (250g julienne)",
            "Stir-fry Mix (300g)",
            "Salad Bowl Mix (250g)",
            "Diced Mango (250g)",
            "Watermelon Cubes (500g)",
        ],
    },
}


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


PRODUCT_CSV_TEMPLATE = """name,category,available_cuts,available_weights,price,base_unit,description,image,tags
Onion,cut-veg,sliced|diced|shredded|grated,250g|500g|1kg,59,250g,Peeled onion cut your way,,prep-ready
Potato,cut-veg,cubed|sliced|batonnet|diced,250g|500g|1kg,55,500g,Peeled and cut potatoes,,ready-to-cook
Carrot,cut-veg,batonnet|diced|julienne|grated,250g|500g,69,250g,Peeled carrots your way,,chef-cut
Mango,cut-fruit,diced|sliced|cubed,250g|500g,199,250g,Sweet mango chilled & ready,,ready-to-eat
Pineapple,cut-fruit,sliced|cubed|diced,250g|500g,129,500g,Golden pineapple cored & ready,,ready-to-eat
Tomato,whole,whole,500g|1kg,45,500g,Sun-ripened plum tomatoes,,fresh|organic
Alphonso Mango,whole,whole,500g|1kg,349,1kg,The king of mangoes,,seasonal|premium
Baby Spinach,whole,whole,250g|500g,39,250g,Tender leafy greens tripled-washed,,leafy
Stir-fry Mix,ready-mix,mix,300g|500g,149,300g,Bell peppers baby corn broccoli carrots wok-ready,,quick-meal
Biryani Veggie Mix,ready-mix,mix,300g|500g,129,300g,Beans carrots cauliflower peas biryani-ready,,indian|quick-meal
"""


@api.get("/templates/products.csv")
async def download_products_template():
    return Response(
        content=PRODUCT_CSV_TEMPLATE,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="freshcuts_products_template.csv"'},
    )


@api.get("/templates/prices.csv")
async def download_prices_template():
    """CSV with every current SKU pre-filled. Fill 'new_price' column and send back."""
    docs = await db.products.find({}, {"_id": 0}).sort([("category", 1), ("name", 1)]).to_list(500)
    lines = ["sku,name,local_name,category,base_unit,current_price,new_price"]
    for d in docs:
        sku = d.get("sku") or ""
        name = (d.get("name") or "").replace(",", " ")
        local = (d.get("local_name") or "").replace(",", " ")
        cat = d.get("category") or ""
        unit = d.get("unit") or ""
        price = d.get("price") or ""
        lines.append(f"{sku},{name},{local},{cat},{unit},{price},")
    return Response(
        content="\n".join(lines) + "\n",
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="freshcuts_prices_template.csv"'},
    )


class PriceUpdate(BaseModel):
    sku: str
    price: float


@api.post("/admin/prices/bulk")
async def bulk_update_prices(updates: List[PriceUpdate], _=Depends(require_admin)):
    updated, missing = 0, []
    for u in updates:
        r = await db.products.update_one({"sku": u.sku}, {"$set": {"price": float(u.price)}})
        if r.matched_count:
            updated += 1
        else:
            missing.append(u.sku)
    return {"updated": updated, "missing_skus": missing}


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
        query["available_cuts"] = {"$regex": cut_type, "$options": "i"}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"local_name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
        ]
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


# --- Subscriptions ---
@api.get("/subscriptions/boxes")
async def list_boxes():
    return [{"id": k, **v} for k, v in BOXES.items()]


@api.post("/subscriptions", response_model=Subscription)
async def create_subscription(body: SubscriptionIn, user=Depends(get_current_user)):
    pc = await db.pincodes.find_one({"pincode": body.pincode})
    if not pc:
        raise HTTPException(400, "Pincode not serviceable")
    box = BOXES.get(body.box_type)
    if not box:
        raise HTTPException(400, "Invalid box type")
    days_ahead = 7 if body.frequency == "weekly" else 14
    sub = Subscription(
        user_email=user["email"],
        price_per_box=float(box["price"]),
        box_name=box["name"],
        box_items=box["items"],
        next_delivery=datetime.now(timezone.utc) + timedelta(days=min(days_ahead, 3)),
        **body.dict(),
    )
    doc = sub.dict()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["next_delivery"] = doc["next_delivery"].isoformat()
    await db.subscriptions.insert_one(doc)
    return sub


@api.get("/subscriptions", response_model=List[Subscription])
async def my_subscriptions(user=Depends(get_current_user)):
    docs = await db.subscriptions.find({"user_email": user["email"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [Subscription(**d) for d in docs]


@api.post("/subscriptions/{sub_id}/pause")
async def pause_subscription(sub_id: str, user=Depends(get_current_user)):
    result = await db.subscriptions.update_one(
        {"id": sub_id, "user_email": user["email"]},
        {"$set": {"status": "paused"}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Subscription not found")
    return {"ok": True}


@api.delete("/subscriptions/{sub_id}")
async def cancel_subscription(sub_id: str, user=Depends(get_current_user)):
    result = await db.subscriptions.update_one(
        {"id": sub_id, "user_email": user["email"]},
        {"$set": {"status": "cancelled"}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Subscription not found")
    return {"ok": True}


app.include_router(api)

# Serve product photos uploaded to /app/backend/static/
_STATIC_DIR = ROOT_DIR / "static"
_STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=_STATIC_DIR), name="static")


# ============== SEED DATA ==============
# Each product represents ONE vegetable/fruit with configurable weight & cut choices.
STANDARD_WEIGHTS = ["250g", "500g", "1kg"]
ALL_CUTS = ["sliced", "diced", "shredded", "batonnet", "cubed", "grated", "julienne"]

SEED_PRODUCTS = []


# Freshncut pre-cut vegetables catalog (SKU, English name, Local name, list of cut types)
CUTVEG_CATALOG = [
    ("FNCAMT", "Amaranth", "Rajgira / Lal Math", ["peeled"]),
    ("FNCASH", "Ash Gourd", "Petha / Kohla", ["diced"]),
    ("FNCASP", "Asparagus", "Shatavari", ["diagonally sliced"]),
    ("FNCBCN", "Baby Corn", "Baby Corn", ["halves", "quarters"]),
    ("FNCBNS", "Banana Stem", "Tana / Khod", ["sliced", "diced"]),
    ("FNCBSL", "Basil Leaves", "Tulsi Patta", ["peeled"]),
    ("FNCBPT", "Baby Potato", "Dum Aloo", ["whole"]),
    ("FNCBET", "Beetroot", "Chukandar / Beet", ["sliced", "diced", "julienne", "batonnet"]),
    ("FNCBRG", "Bitter Gourd", "Karela / Karli", ["sliced-full", "sliced-half", "diced", "stuff long (halved)", "stuff long (quartered)"]),
    ("FNCBTG", "Bottle Gourd", "Loki / Dudhi", ["sliced", "diced"]),
    ("FNCBBH", "Brinjal", "Bharata Baingan / Vangi", ["whole"]),
    ("FNCBKT", "Brinjal Kateri", "Baingan / Vangi", ["diced", "quarters"]),
    ("FNCBRB", "Broad / Flat Beans", "Sem / Ghevada / Val", ["peeled", "fine long"]),
    ("FNCCBG", "Cabbage", "Patta Gobi / Kobi", ["shredded"]),
    ("FNCCCM", "Capsicum", "Shimla Mirch / Mirchi", ["rings", "julienne", "diced", "halved", "quartered", "minced", "top removed"]),
    ("FNCCGR", "Capsicum Mix", "Shimla Mirch (Lal & Hirvi)", ["rings", "julienne", "diced", "halved", "quartered", "minced", "top removed"]),
    ("FNCCRT", "Carrot", "Gajar", ["julienne", "sliced", "batonnet", "brunoise", "diced", "shredded"]),
    ("FNCCLF", "Cauliflower", "Phul Gobi / Kobi", ["mini florets", "medium florets", "cleaned stems"]),
    ("FNCTM",  "Cherry Tomato", "Cherry Tamatar", ["halves", "quarters"]),
    ("FCCLB",  "Cluster Bean", "Gwar / Gavar", ["fine long", "fine chopped"]),
    ("FNCCCN", "Coconut", "Nariyal / Naral", ["grated", "diced-large", "sliced"]),
    ("FNCCOL", "Colocasia", "Arbi / Aloo", ["sliced", "diced"]),
    ("FNCCOR", "Coriander", "Hara Dhaniya / Kothinmbir", ["peeled"]),
    ("FNCCWP", "Cowpea Beans", "Lobia / Chawali", ["peeled", "fine long", "fine chopped"]),
    ("FNCCCB", "Cucumber", "Khira / Kakadi", ["sliced", "diced", "quarters", "spears"]),
    ("FCCRL",  "Curry Leaves", "Curry Patta / Kadhi Patta", ["cleaned"]),
    ("FNCDLL", "Dill Leaves", "Suva / Shepu", ["peeled"]),
    ("FNCDRM", "Drumstick", "Shevga", ["fine long 2in", "sambhar long 3in"]),
    ("FNCFNG", "Fenugreek", "Methi", ["peeled"]),
    ("FNCFRB", "French Beans", "Sem Fali / Farasbee", ["fine long", "fine chopped"]),
    ("FNCGRL", "Garlic", "Lahsun / Lasun", ["peeled", "diced", "chopped", "smashed"]),
    ("FNCGNR", "Ginger", "Adrak / Aale", ["chopped", "smashed", "sliced"]),
    ("FNCAWL", "Gooseberry", "Awala / Amla", ["sliced", "diced"]),
    ("FNCGCH", "Green Chilli", "Hari Mirch / Mirchi", ["diced", "fine long", "quarters", "halves"]),
    ("FNCGRP", "Green Peas", "Matar / Hirva Vatana", ["peeled"]),
    ("FNCGYM", "Green Pumpkin", "Kaddu / Bhopla", ["diced", "batonnet"]),
    ("FNCGNT", "Groundnut Pods", "Mungfali / Bhuimug", ["whole"]),
    ("FNCIVG", "Ivy Gourd", "Tindora / Tendali", ["sliced", "diced", "wedges"]),
    ("FCLDF",  "Lady's Finger", "Bhindi / Bhendi", ["roundels", "fine longs", "cross longs", "stuff long (halved)", "stuff long (quartered)"]),
    ("FLMN",   "Lemon", "Nimbu / Limbu", ["sliced", "quarters", "halves"]),
    ("FNCLMG", "Lemon Grass", "Nimbu Ghaas / Gavati Chaha", ["fine long"]),
    ("FNCLSM", "Lotus Stem", "Kamal Kakadi", ["sliced"]),
    ("FNCMIN", "Mint Leaves", "Pudina", ["peeled"]),
    ("FNCMSR", "Mushroom", "Chatrak / Alambi", ["sliced", "quarters", "diced", "julienne"]),
    ("FNCONN", "Onion", "Pyaj / Kanda", ["rings", "diced", "strips"]),
    ("FNCPNG", "Pointed Gourd", "Parwal / Parval", ["sliced", "diced"]),
    ("FNCPOT", "Potato", "Aloo / Batata", ["sliced", "wedges", "diced", "sticks (finger chips)"]),
    ("FNCRDS", "Radish", "Muli / Mula", ["sliced", "diced"]),
    ("FNCRBN", "Raw Banana", "Kaccha Kela", ["sliced", "diagonally cut"]),
    ("FNCRPP", "Raw Papaya", "Kaccha Papita / Papaya", ["diced", "fine longs"]),
    ("FNCRCG", "Red Cabbage", "Lal Gobhi / Lal Kobi", ["shredded"]),
    ("FNCRDG", "Ridge Gourd", "Turai / Dodka", ["sliced", "diced"]),
    ("FNCSMO", "Sambar Onion", "Sambar Pyaj / Kanda", ["whole", "halves"]),
    ("FNCSNG", "Snake Gourd", "Chichinda / Padwal", ["sliced", "diced"]),
    ("FNCSPI", "Spinach", "Palak", ["peeled"]),
    ("FNCSPG", "Sponge Gourd", "Gilki / Ghosale", ["sliced", "diced"]),
    ("FNCSRO", "Spring Onion", "Hara Pyaj / Kanda Pat", ["fine long", "chopped"]),
    ("FNCSPR", "Sprouts", "Sprouts", ["mixed", "mataki", "moong", "methi", "chana"]),
    ("FNCSWT", "Sweet Corn", "Makai / Maka", ["peeled"]),
    ("FNCSWP", "Sweet Potato", "Shakarkand / Ratale", ["roundels"]),
    ("FNCSTA", "Sweet Tamarind", "Imli / Chinch", ["whole cleaned"]),
    ("FNCTOM", "Tomato", "Tamatar", ["sliced", "wedges", "diced"]),
    ("FNCTRN", "Turnips", "Shalgam / Salgam", ["sliced-full", "sliced-half", "diced"]),
    ("FNCYAM", "Yam", "Suran", ["diced-med", "diced-large", "batonnet"]),
    ("FNCYPM", "Yellow Pumpkin", "Kaddu / Lal Bhopla", ["diced", "batonnet"]),
]

# Reasonable Unsplash images for the common ones; fallback to a generic cut-veg photo.
_CUTVEG_IMAGE_BY_NAME = {
    "onion": "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=600&q=80",
    "potato": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
    "baby potato": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
    "carrot": "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600&q=80",
    "cabbage": "https://images.unsplash.com/photo-1571168290120-ee27fbdb3fe0?w=600&q=80",
    "red cabbage": "https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&q=80",
    "cauliflower": "https://images.unsplash.com/photo-1568584711271-6c929fb49b60?w=600&q=80",
    "tomato": "https://images.unsplash.com/photo-1546470427-e5380b6d1cf6?w=600&q=80",
    "cherry tomato": "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=600&q=80",
    "capsicum": "https://images.unsplash.com/photo-1598295309854-cfa5819004d8?w=600&q=80",
    "capsicum mix": "https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=600&q=80",
    "beetroot": "https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600&q=80",
    "bitter gourd": "https://images.unsplash.com/photo-1642781125538-1a3c69adbf27?w=600&q=80",
    "bottle gourd": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "brinjal": "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80",
    "brinjal kateri": "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80",
    "spinach": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80",
    "coriander": "https://images.unsplash.com/photo-1602753172773-f74dcf60e42a?w=600&q=80",
    "mint leaves": "https://images.unsplash.com/photo-1600841867003-46a30cbec92f?w=600&q=80",
    "basil leaves": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80",
    "fenugreek": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "dill leaves": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80",
    "curry leaves": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80",
    "asparagus": "https://images.unsplash.com/photo-1611743140544-c56d2bc7d34f?w=600&q=80",
    "baby corn": "https://images.unsplash.com/photo-1601472544106-b0b0d7f0ce7d?w=600&q=80",
    "sweet corn": "https://images.unsplash.com/photo-1601472544106-b0b0d7f0ce7d?w=600&q=80",
    "cucumber": "https://images.unsplash.com/photo-1568569350062-ebfa3cb195df?w=600&q=80",
    "french beans": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=600&q=80",
    "cluster bean": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=600&q=80",
    "cowpea beans": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=600&q=80",
    "broad / flat beans": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=600&q=80",
    "green chilli": "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=600&q=80",
    "green peas": "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&q=80",
    "garlic": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80",
    "ginger": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&q=80",
    "lemon": "https://images.unsplash.com/photo-1587496679742-bad053cd6fbb?w=600&q=80",
    "lemon grass": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80",
    "mushroom": "https://images.unsplash.com/photo-1518588178123-46a25da7601c?w=600&q=80",
    "raw banana": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
    "raw papaya": "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=600&q=80",
    "radish": "https://images.unsplash.com/photo-1553536645-a1b5c14b8bef?w=600&q=80",
    "sweet potato": "https://images.unsplash.com/photo-1596097635121-14b8b8b2d9b1?w=600&q=80",
    "yam": "https://images.unsplash.com/photo-1596097635121-14b8b8b2d9b1?w=600&q=80",
    "coconut": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&q=80",
    "gooseberry": "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80",
    "green pumpkin": "https://images.unsplash.com/photo-1509461399763-2416a41bef1e?w=600&q=80",
    "yellow pumpkin": "https://images.unsplash.com/photo-1509461399763-2416a41bef1e?w=600&q=80",
    "drumstick": "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=600&q=80",
    "sambar onion": "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=600&q=80",
    "spring onion": "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=600&q=80",
    "amaranth": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&q=80",
    "banana stem": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
    "colocasia": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
    "ivy gourd": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "ridge gourd": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "sponge gourd": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "snake gourd": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "ash gourd": "https://images.unsplash.com/photo-1509461399763-2416a41bef1e?w=600&q=80",
    "pointed gourd": "https://images.unsplash.com/photo-1594282497782-adb5b1efdf3f?w=600&q=80",
    "turnips": "https://images.unsplash.com/photo-1553536645-a1b5c14b8bef?w=600&q=80",
    "lotus stem": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&q=80",
    "sweet tamarind": "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80",
    "sprouts": "https://images.unsplash.com/photo-1553536645-a1b5c14b8bef?w=600&q=80",
    "groundnut pods": "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80",
    "lady's finger": "https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&q=80",
}

_DEFAULT_CUTVEG_IMG = "https://images.unsplash.com/photo-1598295309854-cfa5819004d8?w=600&q=80"


def _build_cutveg_products():
    items = []
    for sku, name, local_name, cuts in CUTVEG_CATALOG:
        photos = _photos_for(name) if "_photos_for" in globals() else []
        img = photos[0] if photos else _CUTVEG_IMAGE_BY_NAME.get(name.lower(), _DEFAULT_CUTVEG_IMG)
        items.append({
            "sku": sku,
            "name": name,
            "local_name": local_name,
            "category": "cut-veg",
            "cut_type": cuts[0] if cuts else "whole",
            "price": 59.0,
            "unit": "250g",
            "image": img,
            "gallery": photos,
            "stock": 50,
            "tags": ["prep-ready"],
            "description": f"Freshly cut {name.lower()} ({local_name}). Choose your preferred cut: {', '.join(cuts)}.",
            "available_cuts": cuts if cuts else ["whole"],
            "available_weights": ["250g", "500g", "1kg"],
        })
    return items


SEED_PRODUCTS.extend(_build_cutveg_products())


# ============================================================================
# WHOLE VEGETABLES & FRUITS CATALOG
WHOLE_CATALOG = [
    # Vegetables
    ("WHLAMT", "Amaranth", "Rajgira / Lal Math"), ("WHLASH", "Ash Gourd", "Petha / Kohla"),
    ("WHLASP", "Asparagus", "Shatavari"), ("WHLBCN", "Baby Corn", "Baby Corn"),
    ("WHLBNS", "Banana Stem", "Tana / Khod"), ("WHLBSL", "Basil Leaves", "Tulsi Patta"),
    ("WHLBET", "Baby Potato", "Dum Aloo"), ("WHLBRG", "Beetroot", "Chukandar / Beet"),
    ("WHLBTG", "Bitter Gourd", "Karela / Karli"), ("WHLBBH", "Bottle Gourd", "Loki / Dudhi"),
    ("WHLBKT", "Brinjal Bharata", "Bharata Baingan / Vangi"), ("WHLBRB", "Brinjal Kateri", "Baingan / Vangi"),
    ("WHLCHG", "Broad / Flat Beans", "Sem / Ghevada / Val"), ("WHLCCM", "Cabbage", "Patta Gobi / Kobi"),
    ("WHLCHM", "Capsicum", "Shimla Mirch / Mirchi"), ("WHLCRT", "Capsicum Mix", "Shimla Mirch Lal & Hirvi"),
    ("WHLCLF", "Carrot", "Gajar"), ("WHLCTM", "Cauliflower", "Phul Gobi / Kobi"),
    ("WHLCLB", "Cherry Tomato", "Cherry Tamatar"), ("WHLCCN", "Cluster Bean", "Gwar / Gavar"),
    ("WHLCOL", "Coconut", "Nariyal / Naral"), ("WLCOR",  "Colocasia", "Arbi / Aloo"),
    ("WLCWP",  "Coriander", "Hara Dhaniya / Kothinmbir"), ("WLCCB",  "Cowpea Beans", "Lobia / Chawali"),
    ("WLCRI",  "Cucumber", "Khira / Kakadi"), ("WLDLL",  "Curry Leaves", "Curry Patta / Kadhi Patta"),
    ("WLDRM",  "Dill Leaves", "Suva / Shepu"), ("WLFNG",  "Drumstick", "Shevga"),
    ("WLFRB",  "Fenugreek", "Methi"), ("WLGRL",  "French Beans", "Sem Fali / Farasbee"),
    ("WLGN",   "Garlic", "Lahsun / Lasun"), ("WLAWL",  "Ginger", "Adrak / Aale"),
    ("WLCH",   "Gooseberry", "Awala / Amla"), ("WLGRP",  "Green Chilli", "Hari Mirch / Mirchi"),
    ("WLGXM",  "Green Peas", "Matar / Hirva Vatana"), ("WLNT",   "Green Pumpkin", "Kaddu / Bhopla"),
    ("WLIVG",  "Groundnut Pods", "Mungfali / Bhuimug"), ("WLLDF",  "Ivy Gourd", "Tindora / Tendali"),
    ("WLLMN",  "Lady's Finger", "Bhindi / Bhendi"), ("WLLMG",  "Lemon", "Nimbu / Limbu"),
    ("WLLSM",  "Lemon Grass", "Nimbu Ghaas / Gavati Chaha"), ("WLMIN",  "Lotus Stem", "Kamal Kakadi"),
    ("WLMSR",  "Mint Leaves", "Pudina"), ("WLONN",  "Mushroom", "Chatrak / Alambi"),
    ("WLPNG",  "Onion", "Pyaj / Kanda"), ("WLPOT",  "Pointed Gourd", "Parwal / Parval"),
    ("WLRDS",  "Potato", "Aloo / Batata"), ("WLRBN",  "Radish", "Muli / Mula"),
    ("WRPP",   "Raw Banana", "Kaccha Kela"), ("WRCG",   "Raw Papaya", "Kaccha Papita / Papaya"),
    ("WRDG",   "Red Cabbage", "Lal Gobhi / Lal Kobi"), ("WLSMO",  "Ridge Gourd", "Turai / Dodka"),
    ("WLSNG",  "Sambar Onion", "Sambar Pyaj / Kanda"), ("WLPI",   "Snake Gourd", "Chichinda / Padwal"),
    ("WLSPG",  "Spinach", "Palak"), ("WLSR",   "Sponge Gourd", "Gilki / Ghosale"),
    ("WLSPR",  "Spring Onion", "Hara Pyaj / Kanda Pat"), ("WLSWT",  "Sprouts", "Sprouts"),
    ("WLSWP",  "Sweet Corn", "Makai / Maka"), ("WLSTA",  "Sweet Potato", "Shakarkand / Ratale"),
    ("WLTOM",  "Sweet Tamarind", "Imli / Chinch"), ("WLTRN",  "Tomato", "Tamatar"),
    ("WLYAM",  "Turnips", "Shalgam / Salgam"), ("WLYPM",  "Yam", "Suran"),
    ("WLAPL",  "Yellow Pumpkin", "Kaddu / Lal Bhopla"),
    # Fruits (whole)
    ("WLB-APL", "Apple", "Shimla / Kinnaur"), ("WLORG",  "Banana", "Kela"),
    ("WLPPY",  "Orange", "Mosambi"), ("WLPPL",  "Papaya", "Papai"),
    ("WLPOM",  "Pineapple", "Ananas"), ("WLSWL",  "Pomegranate", "Anar / Dalim"),
    ("WLWML",  "Sweet Lemon", "Santra"), ("WLTBZ",  "Watermelon", "Tarbooz / Kalingad"),
]

# Pre-cut fruits (from user's file — first sheet)
CUTFRUIT_CATALOG = [
    ("FNCAPL", "Apple", "Shimla / Kinnaur", ["cubes", "wedges"]),
    ("FNCBNN", "Banana", "Kela", ["sliced", "large-sliced"]),
    ("FNCORG", "Orange", "Mosambi", ["cubes", "wedges"]),
    ("FNCPPY", "Papaya", "Papai", ["cubes", "wedges"]),
    ("FNCPPL", "Pineapple", "Ananas", ["cubes", "sliced"]),
    ("FNCPOM", "Pomegranate", "Anar / Dalim", ["peeled"]),
    ("FNCSWL", "Sweet Lemon", "Santra", ["cubes", "wedges"]),
    ("FNCWML", "Watermelon", "Tarbooz / Kalingad", ["cubes", "wedges"]),
]

# Ready-to-cook premixes (from user's file — first sheet, FNP codes)
READYMIX_CATALOG = [
    ("FNPDTS", "Daily Table Salad", "Cucumber • Carrot • Tomato • Onion Slices + Chat Masala Pouch"),
    ("FNPGJP", "Gujarati Panchkutiyu Shaak Mix", "Yam, Brinjal, Ridge Gourd, Bottle Gourd, Peas, Coconut, Curry Leaves"),
    ("FNPGJU", "Gujarati Undhiyu Mix", "Yam, Potato, French Beans, Raw Banana, Coriander, Coconut"),
    ("FNPJMV", "Jain Mix Vegetables", "French Beans, Peas, Ridge Gourd, Cucumber, Bottle Gourd, Cabbage, Tomato & Coconut"),
    ("FNPJPB", "Jain Pav Bhaji Mix", "Tomato, Capsicum, Cauliflower, Peas, Coriander"),
    ("FNFJHD", "Jain / Handvo Mix", "Peas, Bottle Gourd, Capsicum, Corn"),
    ("FNPMNS", "Manchow Soup-mix", "Garlic-Ginger, Cabbage, Green Chilli, Onion, Spring Onion, Carrot, French Beans"),
    ("FNPMSL", "Misal-pav Mix", "Onion, Tomato, Mataki, Moong, Chawali & White Peas Sprouts, Coriander"),
    ("FNPMPV", "Mix Vegetables", "Potato, Peas, Capsicum, Carrot, French Beans, Cauliflower"),
    ("FNPMXB", "Mix Veggies to Boil / Steam", "Cauliflower, Carrot, French Beans, Peas"),
    ("FNPPVB", "Pav Bhaji Mix Vegetables", "Tomato, Capsicum, Onion, Peas, Coriander, Ginger-Garlic Paste"),
    ("FNPPRM", "Pulav Ready Mix", "Onion, Peas, Tomato, Carrot, French Beans"),
    ("FNPRMV", "Raita Mix Vegetables", "Onion, Cucumber, Green Chilli, Curry & Mint Leaves"),
    ("FNPKHI", "Regular Khichadi Mix", "Potato, Cauliflower, Cabbage, Peas, Onion, Garlic-Ginger"),
    ("FNPVBR", "Regular Vegetable Biryani Mix", "Potato, Peas, Onion, Carrot, French Beans, Cauliflower, Green Chilli"),
    ("FNPSMR", "Sambhar Mix", "Onion, Drumstick, Lady Finger, Tomato, Red Pumpkin, Brinjal"),
    ("FNPSWC", "Sweet Corn Soup-mix", "Sweet Corn, Spring Onion, Carrot, French Beans, Garlic, Ginger"),
    ("FNPVGS", "Vegetable Soup-mix", "Garlic, Spring Onion, Carrot, Peas, French Beans, Sweet Corn, Cabbage"),
]

_WHOLE_DEFAULT_IMG = "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80"
_FRUIT_IMAGES = {
    "apple": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80",
    "banana": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",
    "orange": "https://images.unsplash.com/photo-1587496679742-bad053cd6fbb?w=600&q=80",
    "papaya": "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=600&q=80",
    "pineapple": "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&q=80",
    "pomegranate": "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600&q=80",
    "sweet lemon": "https://images.unsplash.com/photo-1587496679742-bad053cd6fbb?w=600&q=80",
    "watermelon": "https://images.unsplash.com/photo-1595475207225-428b62bda831?w=600&q=80",
}
_READYMIX_IMAGES = {
    "salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    "biryani": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80",
    "pav bhaji": "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&q=80",
    "sambhar": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80",
    "soup": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80",
    "khichadi": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80",
    "pulav": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80",
    "raita": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    "undhiyu": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80",
    "handvo": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80",
    "mix": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80",
}


def _pick_readymix_img(name: str) -> str:
    ln = name.lower()
    for k, v in _READYMIX_IMAGES.items():
        if k in ln:
            return v
    return "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80"


# ---- Match uploaded product photos in /app/backend/static/products ---------
import re as _re

BACKEND_BASE_URL = os.environ.get("BACKEND_BASE_URL", "https://produce-express-12.preview.emergentagent.com")


def _slug(s: str) -> str:
    return _re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _static_url(filename: str) -> str:
    return f"{BACKEND_BASE_URL}/api/static/products/{filename}"


def _scan_product_photos() -> Dict[str, List[str]]:
    """Return {slug: [filename,...]} for every file in /app/backend/static/products."""
    result: Dict[str, List[str]] = {}
    products_dir = _STATIC_DIR / "products"
    if not products_dir.exists():
        return result
    for f in sorted(products_dir.iterdir()):
        if f.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        name_no_ext = _re.sub(r"\s*\(?\d+\)?$", "", f.stem).strip()
        for token in [name_no_ext, name_no_ext.replace("-", " ").replace("_", " ")]:
            result.setdefault(_slug(token), []).append(f.name)
    return result


_PHOTO_INDEX: Dict[str, List[str]] = _scan_product_photos()

# Extra alias mapping: product name → alternative filename slugs to search for
_NAME_ALIASES = {
    "colocasia": ["arvi"],
    "gooseberry": ["awalaw", "amla"],
    "beetroot": ["beetw"],
    "brinjal bharata": ["brinjalbharata"],
    "sweet potato": ["sweetpotatoes"],
    "sweet lemon": ["sweetlemon", "sweetlime"],
    "lady's finger": ["ladyfinger", "ladysfinger"],
    "french beans": ["frenchbeans"],
    "cowpea beans": ["cowpea"],
    "lemon grass": ["lemongrass"],
    "sambar onion": ["sambharonions"],
    "onion": ["redonion"],
    "capsicum": ["capsicumgreen"],
    "yam": ["yamsuran"],
    "pomegranate": ["pomegranatew"],
    "baby corn": ["babycornwhitebackground", "organicbabycorn"],
    "coriander": ["corianderleaves", "organiccoriander"],
    "curry leaves": ["curryleaves"],
    "dill leaves": ["dillleaves"],
    "mint leaves": ["mintleaves"],
    "fenugreek": ["fenugreekleaves"],
    "coconut": ["coconutwhole", "tendercoconut"],
    "chilli": ["chilly", "greenchilly"],
    "green chilli": ["chilly", "greenchilly"],
    "cluster bean": ["clusterbean", "clusterbeans"],
    # Ready-mix
    "gujarati panchkutiyu shaak mix": ["gujpanchkutiyumix"],
    "gujarati undhiyu mix": ["gujundhiyumix"],
    "jain mix vegetables": ["jainmixveg"],
    "jain pav bhaji mix": ["jainpavbhajimix"],
    "jain / handvo mix": ["jainhandvomix", "jainhandavomix"],
    "manchow soup-mix": ["manchawsoupmix"],
    "misal-pav mix": ["misalpavmix"],
    "mix vegetables": ["mixvegetables"],
    "mix veggies to boil / steam": ["veggiestoboil"],
    "pav bhaji mix vegetables": ["regpavbhajimix"],
    "pulav ready mix": ["pulavmix"],
    "raita mix vegetables": ["raitamix"],
    "regular khichadi mix": ["regularkhichadimix"],
    "regular vegetable biryani mix": ["vegbiryanimix"],
    "sambhar mix": ["sambharmix"],
    "sweet corn soup-mix": ["sweetcornsoup"],
    "vegetable soup-mix": ["vegsoupmix"],
}


def _photos_for(name: str) -> List[str]:
    slug = _slug(name)
    files = _PHOTO_INDEX.get(slug, [])
    if not files:
        for alias in _NAME_ALIASES.get(name.lower(), []):
            files = _PHOTO_INDEX.get(_slug(alias), [])
            if files:
                break
    return [_static_url(f) for f in files]


for sku, name, local in WHOLE_CATALOG:
    ln = name.lower()
    photos = _photos_for(name)
    img = photos[0] if photos else (_FRUIT_IMAGES.get(ln) or _CUTVEG_IMAGE_BY_NAME.get(ln, _WHOLE_DEFAULT_IMG))
    SEED_PRODUCTS.append({
        "sku": sku, "name": name, "local_name": local, "category": "whole", "cut_type": "whole",
        "price": 49.0, "unit": "500g", "image": img, "gallery": photos, "stock": 60, "tags": ["fresh"],
        "description": f"Fresh whole {name.lower()} ({local}) — farm to your kitchen.",
        "available_cuts": ["whole"], "available_weights": ["250g", "500g", "1kg"],
    })

for sku, name, local, cuts in CUTFRUIT_CATALOG:
    photos = _photos_for(name)
    img = photos[0] if photos else _FRUIT_IMAGES.get(name.lower(), "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&q=80")
    SEED_PRODUCTS.append({
        "sku": sku, "name": name, "local_name": local, "category": "cut-fruit", "cut_type": cuts[0],
        "price": 129.0, "unit": "250g", "image": img, "gallery": photos, "stock": 30, "tags": ["ready-to-eat"],
        "description": f"Fresh pre-cut {name.lower()} ({local}). Choose your cut: {', '.join(cuts)}.",
        "available_cuts": cuts, "available_weights": ["250g", "500g"],
    })

for sku, name, ingredients in READYMIX_CATALOG:
    photos = _photos_for(name)
    img = photos[0] if photos else _pick_readymix_img(name)
    SEED_PRODUCTS.append({
        "sku": sku, "name": name, "local_name": ingredients, "category": "ready-mix", "cut_type": "mix",
        "price": 149.0, "unit": "300g", "image": img, "gallery": photos, "stock": 25,
        "tags": ["quick-meal", "ready-to-cook"],
        "description": f"{name} — pre-cut & portioned. Includes: {ingredients}.",
        "available_cuts": ["mix"], "available_weights": ["300g", "500g"],
    })


# After _photos_for is defined, backfill cut-veg entries with real photos where available.
for _p in SEED_PRODUCTS:
    if _p.get("category") == "cut-veg":
        _photos = _photos_for(_p["name"])
        if _photos:
            _p["image"] = _photos[0]
            _p["gallery"] = _photos

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
