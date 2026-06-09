import os

from django.core.management.base import BaseCommand

from account.models import Role, User


class Command(BaseCommand):
    help = (
        'Seed the database with initial roles and users. '
        'Passwords are read from environment variables (SEED_*_PASSWORD). '
        'Users without a corresponding password env var are skipped.'
    )

    def handle(self, *args, **options):
        # ── Roles ────────────────────────────────────────────────
        roles_data = [
            {'name': 'super_admin', 'description': 'Full system access with all permissions'},
            {'name': 'admin', 'description': 'Administrative access with limited permissions'},
            {'name': 'user', 'description': 'Standard user access'},
            {'name': 'supplier', 'description': 'Supplier portal access only'},
            {'name': 'junior_admin', 'description': 'Full system access with all permissions'},
        ]

        created_roles = {}
        for role_data in roles_data:
            role, created = Role.objects.get_or_create(
                name=role_data['name'],
                defaults={'description': role_data['description']},
            )
            created_roles[role_data['name']] = role
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created role: {role.get_name_display()}'))
            else:
                self.stdout.write(self.style.WARNING(f'Role already exists: {role.get_name_display()}'))

        # ── Users ────────────────────────────────────────────────
        # Passwords MUST come from environment variables.
        # Set them in .env:
        #   SEED_SUPERADMIN_PASSWORD=YourSecurePassword
        #   SEED_ADMIN_PASSWORD=YourSecurePassword
        #   etc.
        users_data = [
            {
                'email': 'superadmin@superadmin.com',
                'password_env': 'SEED_SUPERADMIN_PASSWORD',
                'full_name': 'Super Admin',
                'role': created_roles['super_admin'],
                'date_of_birth': '1990-01-01',
                'country': 'Nigeria',
            },
            {
                'email': 'pdx_official@pdx.com',
                'password_env': 'SEED_ADMIN_PASSWORD',
                'full_name': 'PDX Admin',
                'role': created_roles['admin'],
                'date_of_birth': '1992-05-15',
                'country': 'Nigeria',
            },
            {
                'email': 'user@user.com',
                'password_env': 'SEED_USER_PASSWORD',
                'full_name': 'Regular User',
                'role': created_roles['user'],
                'date_of_birth': '1995-10-20',
                'country': 'Nigeria',
            },
            {
                'email': 'supplier@supplier.com',
                'password_env': 'SEED_SUPPLIER_PASSWORD',
                'full_name': 'Supplier User',
                'role': created_roles['supplier'],
                'date_of_birth': '1993-03-10',
                'country': 'Kenya',
            },
            {
                'email': 'junior_official@pdx.com',
                'password_env': 'SEED_JUNIOR_PASSWORD',
                'full_name': 'Junior User',
                'role': created_roles['junior_admin'],
                'date_of_birth': '1997-05-10',
                'country': 'Kenya',
            }
        ]

        for user_data in users_data:
            email = user_data['email']
            password_env = user_data.pop('password_env')
            password = os.environ.get(password_env)

            if not password:
                self.stdout.write(self.style.WARNING(
                    f'SKIPPED {email} — environment variable {password_env} is not set.'
                ))
                continue

            # Remove non-model fields before passing to create_user
            user_data_clean = {k: v for k, v in user_data.items() if k != 'email'}

            existing_user = User.objects.filter(email=email).first()
            if existing_user:
                existing_user.set_password(password)
                existing_user.role = user_data_clean['role']
                existing_user.email_verified = True
                existing_user.is_active = True
                existing_user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'Updated user: {email} — Role: {existing_user.role.get_name_display()}'
                ))
            else:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    **user_data_clean,
                )
                user.email_verified = True
                user.is_active = True
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'Created user: {email} — Role: {user.role.get_name_display()}'
                ))

        self.stdout.write(self.style.SUCCESS('\n✓ Seeding completed successfully!'))
        self.stdout.write(
            'Note: Passwords were read from environment variables. '
            'They are NOT printed here for security.'
        )
