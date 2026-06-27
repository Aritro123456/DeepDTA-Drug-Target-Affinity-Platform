import os


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
LOVABLE_FRONTEND_DIR = os.path.join(PROJECT_ROOT, "deepdta-dashboard-main", "dist")
FRONTEND_DIR = LOVABLE_FRONTEND_DIR
RUNTIME_DIR = os.path.join(PROJECT_ROOT, "runtime")
UPLOAD_DIR = os.path.join(RUNTIME_DIR, "workspace_uploads")
RAW_DATA_DIR = os.path.join(PROJECT_ROOT, "data", "raw")

ALLOWED_DATASET_EXTENSIONS = {
    ".csv", ".tsv", ".txt", ".json", ".xlsx", ".xls", ".parquet"
}
PUBLIC_DATASET_DOWNLOADS = {
    "davis-filter.txt",
    "kiba.txt",
}

MODEL_SERVICE_URL = os.environ.get("MODEL_SERVICE_URL", "http://127.0.0.1:5051").rstrip("/")
MODEL_SERVICE_TOKEN = os.environ.get("MODEL_SERVICE_TOKEN", "")
if not MODEL_SERVICE_TOKEN or len(MODEL_SERVICE_TOKEN) < 32:
    raise RuntimeError("MODEL_SERVICE_TOKEN must be set to a long random value before starting the backend.")
MODEL_SERVICE_TOKEN_HEADER = "X-Model-Service-Token"
MODEL_SERVICE_AUTO_START = os.environ.get("MODEL_SERVICE_AUTO_START", "true").lower() == "true"
MODEL_SERVICE_STARTUP_TIMEOUT_SECONDS = float(os.environ.get("MODEL_SERVICE_STARTUP_TIMEOUT_SECONDS", "45"))
MAX_SMILES_LENGTH = int(os.environ.get("MAX_SMILES_LENGTH", "512"))
MAX_PROTEIN_SEQUENCE_LENGTH = int(os.environ.get("MAX_PROTEIN_SEQUENCE_LENGTH", "2000"))


def get_cors_origins():
    configured_origins = os.environ.get("CORS_ALLOWED_ORIGINS")
    if configured_origins:
        return [
            origin.strip()
            for origin in configured_origins.split(",")
            if origin.strip()
        ]
    return [
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ]


def get_database_uri():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    pg_db = os.environ.get("POSTGRES_DB")
    if pg_db:
        pg_user = os.environ.get("POSTGRES_USER", "deepdta_user")
        pg_password = os.environ.get("POSTGRES_PASSWORD", "deepdta_pass")
        pg_host = os.environ.get("POSTGRES_HOST", "db")
        pg_port = os.environ.get("POSTGRES_PORT", "5432")
        return f"postgresql://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_db}"

    return f"sqlite:///{os.path.join(RUNTIME_DIR, 'deepdta_local.db')}"


class Config:
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError("FLASK_SECRET_KEY must be set before starting the backend.")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
    SQLALCHEMY_DATABASE_URI = get_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
