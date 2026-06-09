import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('readiness', '0006_preparednessreport'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReportMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('is_active', models.BooleanField(default=True)),
                ('created_on', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddField(
            model_name='preparednessreport',
            name='member',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reports', to='readiness.reportmember'),
        ),
        migrations.CreateModel(
            name='ReportTeam',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('code', models.CharField(max_length=50, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_on', models.DateTimeField(auto_now_add=True)),
                ('supervisor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='report_teams', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name='reportmember',
            name='team',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='readiness.reportteam'),
        ),
        migrations.AddField(
            model_name='preparednessreport',
            name='team',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='reports', to='readiness.reportteam'),
        ),
        migrations.AlterUniqueTogether(
            name='reportmember',
            unique_together={('team', 'email')},
        ),
    ]