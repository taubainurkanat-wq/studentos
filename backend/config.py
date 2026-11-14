"""Environment settings shared by the application modules."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def database_path() -> Path:
    return Path(os.environ.get('STUDENTOS_DB', str(ROOT / 'studentos.db')))


def public_demo() -> bool:
    return os.environ.get('STUDENTOS_PUBLIC_DEMO', '').strip().lower() in ('1', 'true', 'yes')
