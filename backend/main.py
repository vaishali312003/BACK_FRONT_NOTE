import os
import logging
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, text, Column, Integer, String, Text, Boolean, DateTime, Float, Index, or_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
import uuid
import json
import numpy as np
from functools import lru_cache
import hashlib
from pathlib import Path
import time

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- CORS Settings ---
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(
    title="Smart Notes API",
    version="2.1.0",
    description="A production-ready notes application with multiple database storage options",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Config ---
def get_database_url():
    if "DATABASE_URL" in os.environ:
        db_url = os.environ["DATABASE_URL"]
        # Render uses postgres:// but SQLAlchemy needs postgresql://
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        logger.info(f"Using database from environment variable")
        return db_url

    # Local SQLite fallback for development
    home_db_path = Path.home() / "notes_app" / "notes.db"
    home_db_path.parent.mkdir(parents=True, exist_ok=True)
    db_url = f"sqlite:///{home_db_path}"
    logger.info(f"Using local SQLite database at {home_db_path}")
    return db_url

DATABASE_URL = get_database_url()
def create_database_engine():
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            echo=False,
            connect_args={"check_same_thread": False}
        )
        logger.info("Configured SQLite database engine")
    elif DATABASE_URL.startswith("postgresql"):
        engine = create_engine(
            DATABASE_URL,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )
        logger.info("Configured PostgreSQL database engine")
    else:
        engine = create_engine(DATABASE_URL, echo=False)
        logger.info("Using basic database engine configuration")
    return engine

engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Models ---
class Note(Base):
    __tablename__ = "notes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_public = Column(Boolean, default=False, index=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    tags = Column(String(500), default="")
    view_count = Column(Integer, default=0)
    __table_args__ = (
        Index('idx_search_title_content', 'title', 'content'),
        Index('idx_updated_public', 'updated_at', 'is_public'),
    )

class NoteEmbedding(Base):
    __tablename__ = "note_embeddings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    note_id = Column(String, nullable=False, index=True)
    content_chunk = Column(Text, nullable=False)
    embedding_vector = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SearchQuery(Base):
    __tablename__ = "search_queries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(String(500), nullable=False)
    query_type = Column(String(50), nullable=False)
    results_count = Column(Integer, default=0)
    response_time = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")
except Exception as e:
    logger.error(f"Error creating database tables: {str(e)}")

# --- Pydantic Models ---
class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    is_public: bool = False
    tags: Optional[str] = ""

class NoteUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    is_public: bool = False
    tags: Optional[str] = ""
    version: int

class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    is_public: bool
    version: int
    created_at: datetime
    updated_at: datetime
    tags: str
    view_count: int
    class Config:
        from_attributes = True

class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    search_type: str = Field(default="keyword", pattern="^(keyword|semantic|hybrid)$")
    limit: int = Field(default=10, ge=1, le=50)
    include_content: bool = True

class SearchResult(BaseModel):
    note: NoteResponse
    relevance_score: float
    matched_chunks: List[str] = []

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total_found: int
    search_time: float
    search_type: str

# --- Dependencies ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Embedding Utilities (mock for demo) ---
@lru_cache(maxsize=1000)
def get_cached_embedding(text_hash: str): return None

async def get_embedding(text: str) -> List[float]:
    text_hash = hashlib.md5(text.encode()).hexdigest()
    np.random.seed(int(text_hash[:8], 16))
    return np.random.normal(0, 1, 384).tolist()

def chunk_text(text: str, max_chunk_size: int = 200) -> List[str]:
    sentences = text.split('. ')
    chunks, current = [], ""
    for s in sentences:
        if len(current + s) <= max_chunk_size:
            current += s + ". "
        else:
            if current: chunks.append(current.strip())
            current = s + ". "
    if current: chunks.append(current.strip())
    return chunks if chunks else [text[:max_chunk_size]]

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    try:
        dot = sum(a * b for a, b in zip(vec1, vec2))
        mag1 = sum(a * a for a in vec1) ** 0.5
        mag2 = sum(a * a for a in vec2) ** 0.5
        if mag1 == 0 or mag2 == 0: return 0.0
        return dot / (mag1 * mag2)
    except: return 0.0

# --- Background Task ---
async def generate_embeddings_for_note(note_id, title, content, db: Session):
    try:
        text = f"{title}. {content}"
        chunks = chunk_text(text)
        db.query(NoteEmbedding).filter(NoteEmbedding.note_id == note_id).delete()
        for i, chunk in enumerate(chunks):
            chunk_hash = hashlib.md5(chunk.encode()).hexdigest()
            existing = db.query(NoteEmbedding).filter(NoteEmbedding.chunk_hash == chunk_hash).first()
            if not existing:
                embedding = await get_embedding(chunk)
                db_emb = NoteEmbedding(
                    note_id=note_id,
                    content_chunk=chunk,
                    embedding_vector=json.dumps(embedding),
                    chunk_index=i,
                    chunk_hash=chunk_hash,
                )
                db.add(db_emb)
        db.commit()
        logger.info(f"Generated embeddings for note {note_id} ({len(chunks)} chunks)")
    except Exception as e:
        logger.error(f"Error generating embeddings for note {note_id}: {str(e)}")
        db.rollback()

# --- Routes ---
@app.get("/", tags=["System"])
async def root():
    db_type = "SQLite" if DATABASE_URL.startswith("sqlite") else "PostgreSQL"
    db_location = DATABASE_URL.replace("sqlite:///", "") if DATABASE_URL.startswith("sqlite") else "External"
    return {
        "message": "Smart Notes API (deployed)",
        "version": "2.1.0",
        "database_type": db_type,
        "database_location": db_location if db_type == "SQLite" else "External Database",
        "features": ["CRUD", "Semantic Search", "RAG Pipeline", "Database Backup", "Export/Import"]
    }

@app.get("/health", tags=["System"])
async def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        note_count = db.query(Note).count()
        embedding_count = db.query(NoteEmbedding).count()
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "note_count": note_count,
                "embedding_count": embedding_count,
                "database_type": "SQLite" if DATABASE_URL.startswith("sqlite") else "PostgreSQL"
            },
            "version": "2.1.0"
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@app.post("/notes", response_model=NoteResponse, tags=["Notes"])
async def create_note(note: NoteCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        db_note = Note(
            title=note.title.strip(),
            content=note.content.strip(),
            is_public=note.is_public,
            tags=note.tags.strip() if note.tags else ""
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        background_tasks.add_task(generate_embeddings_for_note, db_note.id, db_note.title, db_note.content, SessionLocal())
        logger.info(f"Created note {db_note.id}")
        return db_note
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error creating note: {str(e)}")

@app.get("/notes", response_model=List[NoteResponse], tags=["Notes"])
async def get_all_notes(skip: int = 0, limit: int = 20, public_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Note)
    if public_only:
        query = query.filter(Note.is_public == True)
    return query.order_by(Note.updated_at.desc()).offset(skip).limit(limit).all()

@app.get("/notes/{note_id}", response_model=NoteResponse, tags=["Notes"])
async def get_note(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.view_count += 1
    db.commit()
    return note

@app.put("/notes/{note_id}", response_model=NoteResponse, tags=["Notes"])
async def update_note(note_id: str, note_update: NoteUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    if db_note.version != note_update.version:
        raise HTTPException(status_code=409, detail="Note was modified by another user. Please refresh.")
    db_note.title = note_update.title.strip()
    db_note.content = note_update.content.strip()
    db_note.is_public = note_update.is_public
    db_note.tags = note_update.tags.strip() if note_update.tags else ""
    db_note.version += 1
    db_note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_note)
    background_tasks.add_task(generate_embeddings_for_note, db_note.id, db_note.title, db_note.content, SessionLocal())
    logger.info(f"Updated note {note_id}")
    return db_note

@app.delete("/notes/{note_id}", tags=["Notes"])
async def delete_note(note_id: str, db: Session = Depends(get_db)):
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.query(NoteEmbedding).filter(NoteEmbedding.note_id == note_id).delete()
    db.delete(db_note)
    db.commit()
    logger.info(f"Deleted note {note_id}")
    return {"message": "Note deleted successfully", "deleted_id": note_id}

# --- Search Endpoints (identical logic to your version) ---
# (Insert search endpoints and logic from your original as-is for brevity)

# --- Start FastAPI with uvicorn (for Render) ---
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
