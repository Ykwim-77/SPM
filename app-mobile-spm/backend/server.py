"""Saúde na Palma da Mão - Patient Backend (FastAPI + MongoDB)."""
from fastapi import FastAPI, APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
import asyncpg
import hashlib
import json
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://postgres:postgres@127.0.0.1:5432/saude_palma")
JWT_SECRET = os.getenv("JWT_SECRET", "saude-na-palma-da-mao-dev-secret-CHANGE-ME")
JWT_ALGO = "HS256"
JWT_EXP_MIN = 60 * 24 * 7


class PostgresQuery:
    def __init__(self, collection: "PostgresCollection", query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        self.collection = collection
        self.query = query or {}
        self.projection = projection or {}
        self.order_by: Optional[str] = None
        self.order_desc = False

    def sort(self, field: str, direction: int = 1):
        self.order_by = field
        self.order_desc = direction != 1
        return self

    async def to_list(self, limit: int = 100):
        return await self.collection._find_many(self.query, limit=limit, sort_field=self.order_by, sort_desc=self.order_desc)


class PostgresCollection:
    def __init__(self, name: str, database: "PostgresDatabase"):
        self.name = name
        self.database = database

    async def _find_many(self, query: Dict[str, Any], limit: int = 100, sort_field: Optional[str] = None, sort_desc: bool = False):
        pool = await self.database.get_pool()
        sql, params = self._build_select(query)
        if sort_field:
            sql += f" ORDER BY payload->>'{sort_field}' {'DESC' if sort_desc else 'ASC'}"
        sql += f" LIMIT ${len(params) + 1}"
        params.append(limit)
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
        return [row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"]) for row in rows]

    def _build_select(self, query: Dict[str, Any]):
        clauses = []
        params: List[Any] = []
        for key, value in query.items():
            if isinstance(value, dict):
                for op, op_value in value.items():
                    if op == "$ne":
                        clauses.append(f"payload->>'{key}' IS DISTINCT FROM ${len(params) + 1}")
                        params.append(op_value)
                    elif op == "$in":
                        clauses.append(f"payload->>'{key}' = ANY(${len(params) + 1}::text[])")
                        params.append(list(op_value))
                    elif op == "$gte":
                        clauses.append(f"payload->>'{key}' >= ${len(params) + 1}")
                        params.append(op_value)
                    elif op == "$lte":
                        clauses.append(f"payload->>'{key}' <= ${len(params) + 1}")
                        params.append(op_value)
            else:
                clauses.append(f"payload->>'{key}' = ${len(params) + 1}")
                params.append(value)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        return f"SELECT payload FROM {self.name}{where}", params

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        pool = await self.database.get_pool()
        sql, params = self._build_select(query)
        sql += f" LIMIT 1"
        async with pool.acquire() as conn:
            row = await conn.fetchrow(sql, *params)
        payload = row["payload"] if row else None
        if payload is None:
            return None
        return payload if isinstance(payload, dict) else json.loads(payload)

    def find(self, query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None):
        return PostgresQuery(self, query, projection)

    async def insert_one(self, doc: Dict[str, Any]):
        pool = await self.database.get_pool()
        payload = json.dumps(doc)
        async with pool.acquire() as conn:
            await conn.execute(
                f"INSERT INTO {self.name} (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload",
                doc.get("id"),
                payload,
            )

    async def insert_many(self, docs: List[Dict[str, Any]]):
        if not docs:
            return
        pool = await self.database.get_pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                for doc in docs:
                    await conn.execute(
                        f"INSERT INTO {self.name} (id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload",
                        doc.get("id"),
                        json.dumps(doc),
                    )

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        pool = await self.database.get_pool()
        set_data = update.get("$set", {})
        if not set_data:
            return
        doc = await self.find_one(query)
        if not doc:
            return
        for key, value in set_data.items():
            doc[key] = value
        payload = json.dumps(doc)
        async with pool.acquire() as conn:
            await conn.execute(
                f"UPDATE {self.name} SET payload = $1 WHERE id = $2",
                payload,
                doc.get("id"),
            )

    async def count_documents(self, query: Dict[str, Any]):
        pool = await self.database.get_pool()
        sql, params = self._build_select(query)
        async with pool.acquire() as conn:
            row = await conn.fetchrow(f"SELECT COUNT(*) AS count FROM (SELECT 1 FROM {self.name}{sql.split('SELECT payload FROM', 1)[1]}) AS sub", *params)
        return int(row["count"])

    async def create_index(self, field: str, unique: bool = False):
        pool = await self.database.get_pool()
        if self.name == "users" and field == "email":
            async with pool.acquire() as conn:
                await conn.execute(
                    f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{self.name}_{field} ON {self.name} ((payload->>'{field}'))"
                )
        else:
            async with pool.acquire() as conn:
                await conn.execute(
                    f"CREATE INDEX IF NOT EXISTS idx_{self.name}_{field} ON {self.name} ((payload->>'{field}'))"
                )

    async def drop(self):
        pool = await self.database.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(f"DROP TABLE IF EXISTS {self.name}")


class PostgresDatabase:
    def __init__(self):
        self.pool = None
        self.users = PostgresCollection("users", self)
        self.appointments = PostgresCollection("appointments", self)
        self.exams = PostgresCollection("exams", self)
        self.medications = PostgresCollection("medications", self)
        self.dose_logs = PostgresCollection("dose_logs", self)

    async def get_pool(self):
        if self.pool is None:
            self.pool = await asyncpg.create_pool(POSTGRES_URL, min_size=1, max_size=5)
        return self.pool

    async def init(self):
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE,
                    payload JSONB NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS appointments (
                    id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS exams (
                    id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS medications (
                    id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL
                )
            """)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS dose_logs (
                    id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL
                )
            """)
            await conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users ((payload->>'email'))")


db = PostgresDatabase()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(title="Saúde na Palma da Mão API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    cpf: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    cpf: Optional[str] = None
    photo_base64: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: List[str] = []
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    # New fields
    phone: Optional[str] = None
    address: Optional[str] = None
    mother_name: Optional[str] = None
    father_name: Optional[str] = None
    birth_certificate: Optional[str] = None
    marriage_certificate: Optional[str] = None
    birthdate: Optional[str] = None
    gender: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    cpf: Optional[str] = None
    photo_base64: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    mother_name: Optional[str] = None
    father_name: Optional[str] = None
    birth_certificate: Optional[str] = None
    marriage_certificate: Optional[str] = None
    birthdate: Optional[str] = None
    gender: Optional[str] = None


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    doctor_name: str
    specialty: str
    location: str
    scheduled_at: str
    status: str = "confirmed"
    queue_position: Optional[int] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AppointmentCreate(BaseModel):
    doctor_name: str
    specialty: str
    location: str
    scheduled_at: str
    notes: Optional[str] = None


class CancelIn(BaseModel):
    reason: str = Field(min_length=3)


class Exam(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    kind: str
    doctor_name: Optional[str] = None
    date: str
    status: str = "ready"
    summary: Optional[str] = None
    file_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Specialties catalog ----------
SPECIALTIES = [
    {"key": "Clínico Geral", "icon": "person",
     "description": "Cuida da saúde geral, avalia sintomas comuns e faz encaminhamentos.",
     "treats": ["febre", "gripe", "dor de cabeça", "check-up geral", "pressão alta"],
     "doctors": ["Dra. Maria Silva", "Dr. Pedro Almeida", "Dr. Rafael Souza"]},
    {"key": "Cardiologista", "icon": "heart",
     "description": "Especialista no coração e sistema circulatório.",
     "treats": ["dor no peito", "arritmia", "hipertensão", "colesterol alto", "coração"],
     "doctors": ["Dr. João Oliveira", "Dra. Patrícia Lima"]},
    {"key": "Endocrinologista", "icon": "pulse",
     "description": "Cuida de hormônios, diabetes, tireoide e obesidade.",
     "treats": ["diabetes", "tireoide", "hormônios", "obesidade", "menopausa"],
     "doctors": ["Dra. Ana Costa", "Dr. Bruno Ferreira"]},
    {"key": "Dermatologista", "icon": "body",
     "description": "Especialista em pele, cabelo e unhas.",
     "treats": ["manchas", "acne", "queda de cabelo", "alergia na pele", "verrugas"],
     "doctors": ["Dra. Luísa Nunes", "Dr. Marcos Ribeiro"]},
    {"key": "Ginecologista", "icon": "female",
     "description": "Saúde da mulher: aparelho reprodutor e prevenção.",
     "treats": ["exames de rotina", "cólicas", "menstruação", "pré-natal", "menopausa"],
     "doctors": ["Dra. Beatriz Rocha", "Dra. Camila Alves"]},
    {"key": "Ortopedista", "icon": "walk",
     "description": "Ossos, articulações, coluna e músculos.",
     "treats": ["dor nas costas", "coluna", "joelho", "fraturas", "torções"],
     "doctors": ["Dr. Carlos Mendes", "Dra. Fernanda Dias"]},
    {"key": "Pediatra", "icon": "happy",
     "description": "Cuida da saúde de crianças e adolescentes.",
     "treats": ["vacinas", "crescimento", "febre infantil", "check-up", "puericultura"],
     "doctors": ["Dra. Helena Barros", "Dr. Igor Cardoso"]},
    {"key": "Oftalmologista", "icon": "eye",
     "description": "Cuida da visão e dos olhos.",
     "treats": ["visão embaçada", "óculos", "conjuntivite", "check-up dos olhos"],
     "doctors": ["Dr. Jorge Teixeira", "Dra. Karen Freitas"]},
    {"key": "Psiquiatra", "icon": "medical",
     "description": "Saúde mental: ansiedade, depressão e outros transtornos.",
     "treats": ["ansiedade", "depressão", "insônia", "pânico", "estresse"],
     "doctors": ["Dr. Lucas Vieira", "Dra. Mariana Pinto"]},
    {"key": "Otorrinolaringologista", "icon": "ear",
     "description": "Ouvido, nariz e garganta.",
     "treats": ["sinusite", "amigdalite", "zumbido", "rouquidão"],
     "doctors": ["Dr. Nelson Aguiar", "Dra. Olívia Ramos"]},
]

COMMON_ALLERGIES = [
    "Dipirona", "Penicilina", "Amoxicilina", "Ibuprofeno", "Diclofenaco",
    "Aspirina (AAS)", "Sulfa", "Codeína", "Iodo", "Látex",
    "Anestésico local", "Contraste radiológico", "Frutos do mar", "Amendoim",
    "Leite", "Ovo", "Glúten", "Poeira", "Pólen", "Pelos de animais",
]


# ---------- Helpers ----------
def hash_password(p: str) -> str:
    return hashlib.sha256(p.encode("utf-8")).hexdigest()


def verify_password(p: str, h: str) -> bool:
    try:
        return hash_password(p) == h
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXP_MIN)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def user_to_out(doc: dict) -> UserOut:
    return UserOut(
        id=doc["id"], email=doc["email"], name=doc.get("name", ""),
        cpf=doc.get("cpf"), photo_base64=doc.get("photo_base64"),
        blood_type=doc.get("blood_type"), allergies=doc.get("allergies", []),
        emergency_contact=doc.get("emergency_contact"),
        emergency_phone=doc.get("emergency_phone"),
        phone=doc.get("phone"), address=doc.get("address"),
        mother_name=doc.get("mother_name"), father_name=doc.get("father_name"),
        birth_certificate=doc.get("birth_certificate"),
        marriage_certificate=doc.get("marriage_certificate"),
        birthdate=doc.get("birthdate"), gender=doc.get("gender"),
    )


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    if not uid:
        raise HTTPException(status_code=401, detail="Token inválido")
    doc = await db.users.find_one({"id": uid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return doc


# ---------- Routes: Auth ----------
@api.get("/")
async def root():
    return {"message": "Saúde na Palma da Mão API - v2"}


@api.post("/auth/register", response_model=Token)
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "name": payload.name, "cpf": payload.cpf,
        "allergies": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    await seed_for_user(uid)
    token = create_token(uid)
    doc.pop("_id", None)
    return Token(access_token=token, user=user_to_out(doc))


@api.post("/auth/login", response_model=Token)
async def login(payload: LoginIn):
    doc = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not doc or not verify_password(payload.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    token = create_token(doc["id"])
    return Token(access_token=token, user=user_to_out(doc))


@api.get("/auth/me", response_model=UserOut)
async def me(current=Depends(get_current_user)):
    return user_to_out(current)


@api.put("/auth/me", response_model=UserOut)
async def update_me(payload: ProfileUpdate, current=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    # If updating email, ensure not taken by another user
    if "email" in updates:
        updates["email"] = updates["email"].lower()
        other = await db.users.find_one({"email": updates["email"], "id": {"$ne": current["id"]}})
        if other:
            raise HTTPException(status_code=400, detail="E-mail já em uso por outra conta")
    if updates:
        await db.users.update_one({"id": current["id"]}, {"$set": updates})
    doc = await db.users.find_one({"id": current["id"]}, {"_id": 0})
    return user_to_out(doc)


# ---------- Routes: Catalogs ----------
@api.get("/specialties")
async def list_specialties():
    return SPECIALTIES


@api.get("/allergies/catalog")
async def allergies_catalog():
    return {"items": COMMON_ALLERGIES}


@api.get("/doctors/{specialty}/available_slots")
async def available_slots(specialty: str, doctor_name: str, date: str, current=Depends(get_current_user)):
    """Return time slots available for a given doctor on a given YYYY-MM-DD."""
    all_slots = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]
    # Find any appointment for this doctor on that date
    day_start = f"{date}T00:00:00"
    day_end = f"{date}T23:59:59"
    booked = await db.appointments.find({
        "doctor_name": doctor_name,
        "specialty": specialty,
        "status": {"$in": ["confirmed", "waitlist"]},
        "scheduled_at": {"$gte": day_start, "$lte": day_end},
    }, {"_id": 0, "scheduled_at": 1}).to_list(100)
    taken = set()
    for b in booked:
        try:
            t = datetime.fromisoformat(b["scheduled_at"].replace("Z", "+00:00"))
            taken.add(t.strftime("%H:%M"))
        except Exception:
            pass
    return {"available": [s for s in all_slots if s not in taken], "taken": sorted(taken)}


# ---------- Routes: Appointments ----------
@api.get("/appointments", response_model=List[Appointment])
async def list_appointments(status_filter: Optional[str] = None, current=Depends(get_current_user)):
    q = {"user_id": current["id"]}
    if status_filter:
        q["status"] = status_filter
    docs = await db.appointments.find(q, {"_id": 0}).sort("scheduled_at", 1).to_list(200)
    return [Appointment(**d) for d in docs]


@api.get("/appointments/{apt_id}", response_model=Appointment)
async def get_appointment(apt_id: str, current=Depends(get_current_user)):
    doc = await db.appointments.find_one({"id": apt_id, "user_id": current["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Consulta não encontrada")
    return Appointment(**doc)


@api.post("/appointments", response_model=Appointment)
async def create_appointment(payload: AppointmentCreate, current=Depends(get_current_user)):
    # Prevent double-booking: same doctor + same scheduled_at, or same user in same time window
    conflict_doctor = await db.appointments.find_one({
        "doctor_name": payload.doctor_name,
        "specialty": payload.specialty,
        "scheduled_at": payload.scheduled_at,
        "status": {"$in": ["confirmed", "waitlist"]},
    })
    if conflict_doctor:
        raise HTTPException(status_code=409, detail="Este horário já está ocupado. Escolha outro.")
    conflict_user = await db.appointments.find_one({
        "user_id": current["id"],
        "scheduled_at": payload.scheduled_at,
        "status": {"$in": ["confirmed", "waitlist"]},
    })
    if conflict_user:
        raise HTTPException(status_code=409, detail="Você já tem outra consulta neste mesmo horário.")
    apt = Appointment(user_id=current["id"], **payload.model_dump())
    await db.appointments.insert_one(apt.model_dump())
    return apt


@api.post("/appointments/{apt_id}/cancel", response_model=Appointment)
async def cancel_appointment(apt_id: str, payload: CancelIn, current=Depends(get_current_user)):
    doc = await db.appointments.find_one({"id": apt_id, "user_id": current["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Consulta não encontrada")
    await db.appointments.update_one(
        {"id": apt_id},
        {"$set": {"status": "cancelled", "cancellation_reason": payload.reason}},
    )
    doc["status"] = "cancelled"
    doc["cancellation_reason"] = payload.reason
    return Appointment(**doc)


# ---------- Routes: Exams ----------
@api.get("/exams", response_model=List[Exam])
async def list_exams(current=Depends(get_current_user)):
    docs = await db.exams.find({"user_id": current["id"]}, {"_id": 0}).sort("date", -1).to_list(200)
    return [Exam(**d) for d in docs]


@api.get("/exams/{exam_id}", response_model=Exam)
async def get_exam(exam_id: str, current=Depends(get_current_user)):
    doc = await db.exams.find_one({"id": exam_id, "user_id": current["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return Exam(**doc)


# ---------- Routes: Dashboard summary ----------
@api.get("/dashboard")
async def dashboard(current=Depends(get_current_user)):
    now_iso = datetime.now(timezone.utc).isoformat()
    next_apt = await db.appointments.find_one(
        {"user_id": current["id"], "status": {"$in": ["confirmed", "waitlist"]},
         "scheduled_at": {"$gte": now_iso}},
        {"_id": 0}, sort=[("scheduled_at", 1)],
    )
    upcoming_count = await db.appointments.count_documents({
        "user_id": current["id"],
        "status": {"$in": ["confirmed", "waitlist"]},
        "scheduled_at": {"$gte": now_iso},
    })
    exams_ready = await db.exams.count_documents({"user_id": current["id"], "status": "ready"})
    exams_pending = await db.exams.count_documents({"user_id": current["id"], "status": "pending"})
    return {
        "next_appointment": next_apt,
        "upcoming_count": upcoming_count,
        "exams_ready": exams_ready,
        "exams_pending": exams_pending,
    }


# ---------- Routes: Notifications (derived) ----------
@api.get("/notifications")
async def notifications(current=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    items = []

    # Upcoming appointments (next 48h)
    apts = await db.appointments.find(
        {"user_id": current["id"], "status": {"$in": ["confirmed", "waitlist"]}},
        {"_id": 0},
    ).sort("scheduled_at", 1).to_list(50)
    for a in apts:
        try:
            when = datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00"))
            delta = when - now
            hours = delta.total_seconds() / 3600
            if 0 <= hours <= 48:
                items.append({
                    "id": f"apt-{a['id']}",
                    "kind": "appointment",
                    "icon": "calendar",
                    "title": "Consulta próxima",
                    "body": f"{a['doctor_name']} ({a['specialty']}) em {int(hours)}h",
                    "when": a["scheduled_at"],
                    "link": f"/appointment/{a['id']}",
                })
        except Exception:
            pass

    # Ready exams (last 30 days)
    exams = await db.exams.find(
        {"user_id": current["id"], "status": "ready"}, {"_id": 0},
    ).sort("date", -1).to_list(50)
    for e in exams[:5]:
        items.append({
            "id": f"exam-{e['id']}",
            "kind": "exam",
            "icon": "document-text",
            "title": "Documento pronto",
            "body": e["title"],
            "when": e["date"],
            "link": f"/exams/{e['id']}",
        })

    # Profile completeness
    missing = []
    if not current.get("blood_type"):
        missing.append("tipo sanguíneo")
    if not current.get("emergency_phone"):
        missing.append("contato de emergência")
    if not current.get("phone"):
        missing.append("seu telefone")
    if missing:
        items.append({
            "id": "profile-incomplete",
            "kind": "profile",
            "icon": "person",
            "title": "Complete seu cadastro",
            "body": f"Falta preencher: {', '.join(missing)}",
            "when": now.isoformat(),
            "link": "/emergency",
        })

    items.sort(key=lambda x: x["when"] or "", reverse=True)
    return {"items": items}


# ---------- Routes: Help / FAQ ----------
@api.get("/help/faq")
async def faq():
    return {"items": [
        {"q": "Como agendar uma consulta?",
         "a": "Na aba Consultas, toque no botão azul com o sinal de + no canto superior direito, escolha a especialidade, o profissional, o dia e o horário disponível, e confirme."},
        {"q": "Como cancelar uma consulta?",
         "a": "Abra a consulta na aba Consultas, toque em Cancelar consulta e informe o motivo (obrigatório)."},
        {"q": "O que é o Cartão de Emergência?",
         "a": "É a sua versão digital do cartão SUS, com tipo sanguíneo, alergias, contato de emergência, filiação e outros dados que socorristas precisam em uma urgência."},
        {"q": "Como atualizar minhas alergias?",
         "a": "Vá em Perfil → Editar dados pessoais ou Cartão de Emergência. Escolha as alergias na lista ou adicione uma nova."},
        {"q": "Meus dados estão seguros?",
         "a": "Sim. Somente você acessa seus dados após entrar com seu e-mail e senha. Ninguém, além dos profissionais de saúde autorizados, pode ver suas informações."},
        {"q": "Não consigo entrar. E agora?",
         "a": "Verifique se digitou o e-mail e senha corretamente. Se esqueceu a senha, entre em contato com a unidade de saúde para redefini-la."},
        {"q": "Como falo com o suporte?",
         "a": "Ligue para o Disque Saúde 136 (24h) ou vá até a UBS mais próxima."},
    ]}


# ---------- Seed sample data ----------
async def seed_for_user(uid: str):
    now = datetime.now(timezone.utc)
    apts = [
        Appointment(
            user_id=uid, doctor_name="Dra. Maria Silva", specialty="Clínico Geral",
            location="UBS Centro - Sala 3", scheduled_at=(now + timedelta(days=2, hours=3)).isoformat(),
            status="confirmed", notes="Traga exames anteriores.",
        ),
        Appointment(
            user_id=uid, doctor_name="Dr. João Oliveira", specialty="Cardiologista",
            location="Policlínica Municipal", scheduled_at=(now + timedelta(days=8)).isoformat(),
            status="waitlist", queue_position=4,
        ),
        Appointment(
            user_id=uid, doctor_name="Dra. Ana Costa", specialty="Endocrinologista",
            location="UBS Jardim", scheduled_at=(now - timedelta(days=15)).isoformat(),
            status="completed",
        ),
    ]
    await db.appointments.insert_many([a.model_dump() for a in apts])

    exams = [
        Exam(user_id=uid, title="Hemograma Completo", kind="exam",
             doctor_name="Dra. Ana Costa", date=(now - timedelta(days=3)).isoformat(),
             status="ready", summary="Resultados dentro da normalidade."),
        Exam(user_id=uid, title="Receita - Losartana 50mg", kind="prescription",
             doctor_name="Dra. Maria Silva", date=(now - timedelta(days=10)).isoformat(),
             status="ready", summary="Uso contínuo por 90 dias."),
        Exam(user_id=uid, title="Ultrassom Abdominal", kind="exam",
             doctor_name="Dr. João Oliveira", date=(now - timedelta(days=1)).isoformat(),
             status="pending", summary="Aguardando laudo."),
    ]
    await db.exams.insert_many([e.model_dump() for e in exams])

    await db.users.update_one({"id": uid}, {"$set": {
        "blood_type": "O+",
        "allergies": ["Dipirona", "Penicilina"],
        "emergency_contact": "Familiar",
        "emergency_phone": "(11) 99999-0000",
        "phone": "(11) 98888-7777",
        "address": "Rua das Flores, 123 - Centro",
        "mother_name": "Maria da Silva",
        "father_name": "José da Silva",
    }})


@app.on_event("startup")
async def startup():
    await db.init()
    await db.users.create_index("email", unique=True)
    try:
        await db.medications.drop()
        await db.dose_logs.drop()
    except Exception:
        pass
    demo_email = "demo" + chr(64) + "saudepalma.com.br"
    existing = await db.users.find_one({"email": demo_email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "email": demo_email,
            "password_hash": hash_password("senha123"),
            "name": "Paciente Demo", "cpf": "000.000.000-00",
            "allergies": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await seed_for_user(uid)
        logger.info("Seeded demo user %s", demo_email)


@app.on_event("shutdown")
async def shutdown():
    if db.pool:
        await db.pool.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)
