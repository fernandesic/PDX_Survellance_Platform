from django.apps import AppConfig


class OutbreakConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'outbreak'
    verbose_name = 'Outbreak Workspace'

    def ready(self):
        # Wire SSE + notification rule engine post_save handlers exactly once.
        try:
            from outbreak.sse import install_signal_handlers
            install_signal_handlers()
        except Exception:  # noqa: BLE001  # pragma: no cover — AppConfig.ready: signal install must never block Django startup
            import logging
            logging.getLogger(__name__).exception(
                "Failed to install outbreak SSE/notification signal handlers"
            )
