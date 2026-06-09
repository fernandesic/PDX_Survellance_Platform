import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()
from django.db import connection
c = connection.cursor()
c.execute("SELECT name FROM django_migrations WHERE app='sentinel' ORDER BY id")
for r in c.fetchall():
    print(r[0])
