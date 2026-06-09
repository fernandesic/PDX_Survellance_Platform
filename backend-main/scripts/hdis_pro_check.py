"""Check hdis_pro_trustscore columns and hdis model code. Read-only."""
import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'datarepr.settings.base')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.db import connection

with connection.cursor() as c:
    c.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'hdis_pro_trustscore' ORDER BY ordinal_position")
    print("=== hdis_pro_trustscore columns ===")
    for r in c.fetchall():
        print(r)
    
    c.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'hdis_pro_briefing' ORDER BY ordinal_position")
    print("\n=== hdis_pro_briefing columns ===")
    for r in c.fetchall():
        print(r)

    c.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'hdis_pro_alert' ORDER BY ordinal_position")
    print("\n=== hdis_pro_alert columns ===")
    for r in c.fetchall():
        print(r)
