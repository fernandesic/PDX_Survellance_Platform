from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from readiness.models import ReportTeam, ReportMember

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed demo supervisor, team, and workers for Preparedness MVP'

    def handle(self, *args, **options):
        # ── 1. Create or get Supervisor user ──
        supervisor_email = 'supervisor@who.int'
        supervisor, created = User.objects.get_or_create(
            email=supervisor_email,
            defaults={
                'full_name': 'Dr. Sarah Kimani',
                'date_of_birth': '1985-03-15',
                'country': 'Kenya',
                'is_staff': True,
                'email_verified': True,
            }
        )
        if created:
            supervisor.set_password('supervisor123')
            supervisor.save()
            self.stdout.write(self.style.SUCCESS(f'  ✓ Created supervisor: {supervisor_email} (password: supervisor123)'))
        else:
            self.stdout.write(f'  • Supervisor already exists: {supervisor_email}')

        # ── 2. Create Team ──
        team, created = ReportTeam.objects.get_or_create(
            code='HEP2026',
            defaults={
                'supervisor': supervisor,
                'name': 'HEP East Africa',
                'is_active': True,
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'  ✓ Created team: {team.name} (code: {team.code})'))
        else:
            self.stdout.write(f'  • Team already exists: {team.name} ({team.code})')

        # ── 3. Create Workers ──
        workers = [
            {'name': 'John Doe',        'email': 'john@who.int'},
            {'name': 'Amina Hassan',     'email': 'amina@who.int'},
            {'name': 'David Okonkwo',    'email': 'david@who.int'},
            {'name': 'Fatima Diallo',    'email': 'fatima@who.int'},
            {'name': 'James Mwangi',     'email': 'james@who.int'},
        ]

        for w in workers:
            member, created = ReportMember.objects.get_or_create(
                team=team,
                email=w['email'],
                defaults={
                    'name': w['name'],
                    'is_active': True,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  ✓ Created worker: {member.name} ({member.email})'))
            else:
                self.stdout.write(f'  • Worker already exists: {member.name} ({member.email})')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('═══ Seed complete! ═══'))
        self.stdout.write('')
        self.stdout.write(f'  Supervisor login:  {supervisor_email} / supervisor123')
        self.stdout.write(f'  Team code:         {team.code}')
        self.stdout.write(f'  Worker form link:  http://localhost:5173/preparedness-form?team={team.code}')
        self.stdout.write(f'  Test emails:       {", ".join(w["email"] for w in workers)}')
        self.stdout.write('')
