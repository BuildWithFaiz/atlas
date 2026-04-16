#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import json
from pathlib import Path

# #region agent log
log_path = Path(__file__).parent.parent / '.cursor' / 'debug.log'
log_path.parent.mkdir(parents=True, exist_ok=True)
with open(log_path, 'a', encoding='utf-8') as f:
    f.write(json.dumps({
        'sessionId': 'debug-session',
        'runId': 'run1',
        'hypothesisId': 'A',
        'location': 'manage.py:9',
        'message': 'Python executable path',
        'data': {'sys.executable': sys.executable, 'cwd': str(Path.cwd())},
        'timestamp': int(__import__('time').time() * 1000)
    }) + '\n')
# #endregion

def main():
    """Run administrative tasks."""
    # #region agent log
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(json.dumps({
            'sessionId': 'debug-session',
            'runId': 'run1',
            'hypothesisId': 'A',
            'location': 'manage.py:24',
            'message': 'Environment check before Django import',
            'data': {
                'VIRTUAL_ENV': os.environ.get('VIRTUAL_ENV', 'NOT_SET'),
                'PYTHONPATH': os.environ.get('PYTHONPATH', 'NOT_SET'),
                'sys.path': sys.path[:5],
                'sys.executable': sys.executable
            },
            'timestamp': int(__import__('time').time() * 1000)
        }) + '\n')
    # #endregion
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rag_backend.settings')
    
    # #region agent log
    venv_python = Path(__file__).parent.parent / '.venv' / 'Scripts' / 'python.exe'
    backend_venv_python = Path(__file__).parent / 'venv' / 'Scripts' / 'python.exe'
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(json.dumps({
            'sessionId': 'debug-session',
            'runId': 'run1',
            'hypothesisId': 'B',
            'location': 'manage.py:39',
            'message': 'Virtual environment paths check',
            'data': {
                '.venv exists': venv_python.exists(),
                '.venv path': str(venv_python),
                'backend/venv exists': backend_venv_python.exists(),
                'backend/venv path': str(backend_venv_python),
                'sys.executable matches .venv': str(sys.executable) == str(venv_python.resolve())
            },
            'timestamp': int(__import__('time').time() * 1000)
        }) + '\n')
    # #endregion
    
    try:
        # #region agent log
        import importlib.util
        django_found = False
        django_path = None
        for path in sys.path:
            django_spec_path = Path(path) / 'django'
            if django_spec_path.exists() and django_spec_path.is_dir():
                django_found = True
                django_path = str(path)
                break
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'run1',
                'hypothesisId': 'C',
                'location': 'manage.py:58',
                'message': 'Django search in sys.path',
                'data': {'django_found_in_paths': django_found, 'django_path': django_path, 'sys.path_count': len(sys.path)},
                'timestamp': int(__import__('time').time() * 1000)
            }) + '\n')
        # #endregion
        
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # #region agent log
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'run1',
                'hypothesisId': 'A',
                'location': 'manage.py:73',
                'message': 'Django import failed',
                'data': {'error': str(exc), 'sys.executable': sys.executable, 'VIRTUAL_ENV': os.environ.get('VIRTUAL_ENV', 'NOT_SET')},
                'timestamp': int(__import__('time').time() * 1000)
            }) + '\n')
        # #endregion
        
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
