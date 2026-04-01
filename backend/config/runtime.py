from pathlib import Path
from urllib.parse import unquote, urlparse


TRUE_VALUES = {'1', 'true', 'yes', 'on'}


def env_flag(value, default=False):
    if value is None:
        return default
    return value.lower() in TRUE_VALUES


def env_list(value, default=''):
    source = default if value is None else value
    return [item.strip() for item in source.split(',') if item.strip()]


def build_database_config(base_dir: Path, env):
    database_url = env.get('DATABASE_URL')
    if not database_url:
        return {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': base_dir / 'db.sqlite3',
            }
        }

    parsed = urlparse(database_url)
    if parsed.scheme in {'postgres', 'postgresql'}:
        return {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': parsed.path.lstrip('/'),
                'USER': unquote(parsed.username or ''),
                'PASSWORD': unquote(parsed.password or ''),
                'HOST': parsed.hostname or '',
                'PORT': parsed.port or 5432,
            }
        }

    if parsed.scheme == 'sqlite':
        database_name = unquote(parsed.path or '')
        if database_name.startswith('/'):
            return {
                'default': {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': database_name,
                }
            }

        return {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': base_dir / (database_name or 'db.sqlite3'),
            }
        }

    raise ValueError(f'Unsupported database scheme: {parsed.scheme}')