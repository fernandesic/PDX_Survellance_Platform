"""
Agent persistence models — AgentRun + AgentStep.

Phase-2 of the alerts-v2 agentic redesign. Kept in a separate file from
models.py so the boundary is obvious and the work is independently revertable.
Re-exported via `from .models_agent import *` at the bottom of models.py.
"""

import uuid

from django.db import models

from .models import Signal


class AgentRunStatus(models.TextChoices):
    QUEUED = 'queued', 'Queued'
    RUNNING = 'running', 'Running'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'


class AgentStepKind(models.TextChoices):
    PERCEIVE = 'perceive', 'Perceive'
    CLASSIFY = 'classify', 'Classify'
    CORROBORATE = 'corroborate', 'Corroborate'
    DEBATE = 'debate', 'Debate'
    REVIEW = 'review', 'Review'
    NOTIFY = 'notify', 'Notify'
    REFLECT = 'reflect', 'Reflect'


class AgentRun(models.Model):
    """One execution of the agent pipeline against a single Signal."""

    run_id = models.UUIDField(
        primary_key=True, default=uuid.uuid4, editable=False
    )
    signal = models.ForeignKey(
        Signal, on_delete=models.CASCADE, related_name='agent_runs'
    )
    status = models.CharField(
        max_length=20,
        choices=AgentRunStatus.choices,
        default=AgentRunStatus.QUEUED,
    )
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    confidence = models.DecimalField(
        max_digits=4, decimal_places=3, null=True, blank=True,
        help_text='Final adjudicated confidence in [0.000, 1.000]',
    )
    corroboration_count = models.PositiveIntegerField(default=0)

    provider = models.CharField(max_length=30, blank=True, default='')
    model_name = models.CharField(max_length=80, blank=True, default='')
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['signal', '-started_at']),
            models.Index(fields=['status', '-started_at']),
        ]

    def __str__(self):
        return f"AgentRun {self.run_id} signal={self.signal_id} {self.status}"


class AgentStep(models.Model):
    """One step within an AgentRun (perceive, classify, corroborate, ...)."""

    run = models.ForeignKey(
        AgentRun, on_delete=models.CASCADE, related_name='steps'
    )
    step_number = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=20, choices=AgentStepKind.choices)
    agent_name = models.CharField(max_length=60, blank=True, default='')

    input_summary = models.TextField(blank=True, default='')
    output_summary = models.TextField(blank=True, default='')
    reasoning = models.TextField(blank=True, default='')

    citations = models.JSONField(default=list, blank=True)

    latency_ms = models.PositiveIntegerField(default=0)
    tokens_used = models.PositiveIntegerField(null=True, blank=True)
    model_name = models.CharField(max_length=80, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['run', 'step_number']
        indexes = [
            models.Index(fields=['run', 'step_number']),
            models.Index(fields=['-created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['run', 'step_number'],
                name='agentstep_unique_step_per_run',
            ),
        ]

    def __str__(self):
        return f"AgentStep run={self.run_id} #{self.step_number} {self.kind}"
