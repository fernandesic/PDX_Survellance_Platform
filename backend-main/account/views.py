"""
Account — Views (Thin HTTP Handlers)

Views handle HTTP concerns only: parsing requests, returning responses,
setting cookies. All business logic lives in services.py and selectors.py.
"""

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
import logging

import utils.authentication
from utils.throttles import LoginRateThrottle, TokenRefreshRateThrottle
from utils.cookies import set_auth_cookies, clear_auth_cookies
from utils.index import custom_response
from utils.pagination import LargeResultsSetPagination
from utils.permissions import IsNotSupplierRole
from utils.filters import AlertFilter

from .models import Alert
from .serializers import AlertSerializer
from .services import (
    authenticate_user,
    authenticate_sso_user,
    build_user_data,
    logout_user,
    refresh_tokens,
    AuthenticationError,
    TokenError,
)
from .selectors import get_overview_data, get_news_data

from django_filters.rest_framework import DjangoFilterBackend

logger = logging.getLogger(__name__)


# ─── Auth Views ──────────────────────────────────────────────────────────────


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    @swagger_auto_schema(
        operation_summary="Login Endpoint",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'email': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_EMAIL),
                'password': openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_PASSWORD),
                'browser_session_id': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description="Optional: Unique browser session identifier for multi-browser support",
                ),
            },
            required=['email', 'password'],
        ),
    )
    def post(self, request):
        try:
            result = authenticate_user(
                email=request.data['email'],
                password=request.data['password'],
                browser_session_id=request.data.get('browser_session_id'),
                request=request,
            )
            response = custom_response(
                status="Success",
                message="Login successful, User Authenticated!",
                data={
                    'access': result['access_token'],
                    'refresh': result['refresh_token'],
                    'user': result['user_data'],
                },
            )
            set_auth_cookies(response, result['access_token'], result['refresh_token'])
            return response

        except AuthenticationError as e:
            return custom_response(
                status="Error",
                message=str(e),
                data={},
                http_status=status.HTTP_400_BAD_REQUEST,
            )


# ─── SSO Views (Azure AD via MSAL) ──────────────────────────────────────


class SSOInitView(APIView):
    """
    Start the SSO login flow.

    Returns the Azure AD authorization URL. The frontend redirects the
    browser to this URL. Azure AD authenticates the user and redirects
    back to SSOCallbackView with an authorization code.

    PKCE, state, and nonce are handled automatically by MSAL.
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def get(self, request):
        from django.conf import settings as conf

        if not conf.AZURE_AD_CLIENT_ID:
            return custom_response(
                status="Error",
                message="SSO is not configured. Contact your administrator.",
                data={},
                http_status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            from .adapters import build_auth_url
            flow = build_auth_url(request)

            # Store flow in Django session for callback verification
            request.session['sso_auth_flow'] = flow

            return custom_response(
                status="Success",
                message="SSO authorization URL generated.",
                data={'auth_url': flow['auth_uri']},
            )
        except Exception as e:  # noqa: BLE001 — top-level SSO view: any failure must return a structured error response
            logger.error("SSO init failed: %s", e)
            return custom_response(
                status="Error",
                message="Failed to initialize SSO. Please try again.",
                data={},
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class SSOCallbackView(APIView):
    """
    Handle the Azure AD OAuth callback.

    Azure AD redirects here with an authorization code after the user
    authenticates. This view:
    1. Exchanges the code for tokens (MSAL handles PKCE + signature verification)
    2. Provisions or syncs the user (JIT)
    3. Creates a PDX CustomAuthToken (same as local login)
    4. Sets httpOnly auth cookies
    5. Redirects the browser to the frontend dashboard

    This is a browser redirect (GET), not an API call.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from django.conf import settings as conf
        from django.shortcuts import redirect
        from .adapters import complete_auth_flow, provision_or_sync_user
        from utils.audit import log_audit
        from .models import AuditLog

        frontend_url = conf.LOGIN_REDIRECT_URL
        error_url = f"{frontend_url}/login?sso_error="

        # Retrieve the auth flow from session
        auth_flow = request.session.pop('sso_auth_flow', None)
        if not auth_flow:
            logger.warning("SSO callback without auth flow in session")
            return redirect(f"{error_url}session_expired")

        # Check for Azure AD error in callback
        if 'error' in request.GET:
            error = request.GET.get('error_description', request.GET.get('error', 'unknown'))
            logger.error("Azure AD returned error: %s", error)
            return redirect(f"{error_url}provider_error")

        try:
            # Step 1: Exchange authorization code for tokens
            token_result = complete_auth_flow(request, auth_flow)

            # Step 2: JIT provision or sync user
            user, created = provision_or_sync_user(token_result)

            # Step 3: Create PDX auth tokens (same system as local login)
            result = authenticate_sso_user(
                user=user,
                request=request,
                provider='microsoft',
            )

            # Step 4: Log JIT provisioning if new user
            if created:
                log_audit(
                    request=request,
                    user=user,
                    action=AuditLog.Action.ADMIN_ACTION,
                    detail=f"SSO JIT provisioned new user: {user.email}",
                )

            # Step 5: Redirect to frontend with cookies
            # The frontend will detect the user via AuthProvider session check
            response = redirect(frontend_url)
            set_auth_cookies(response, result['access_token'], result['refresh_token'])
            return response

        except ValueError as e:
            logger.error("SSO callback failed: %s", e)
            return redirect(f"{error_url}auth_failed")
        except Exception as e:  # noqa: BLE001 — top-level SSO callback: any failure must redirect to the error page
            logger.exception("Unexpected SSO callback error: %s", e)
            return redirect(f"{error_url}internal_error")


class LogoutView(APIView):
    authentication_classes = [utils.authentication.CustomTokenAuthentication]
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Logout Endpoint",
        responses={200: "Successfully logged out."},
    )
    def post(self, request):
        try:
            logout_user(request=request)
            response = custom_response(
                status="Success",
                message="Successfully logged out.",
                data={},
            )
            clear_auth_cookies(response)
            return response
        except Exception as e:  # noqa: BLE001 — top-level logout: any failure must still return a structured response
            logger.error(f"Logout error: {str(e)}")
            return custom_response(
                status="Error",
                message="An error occurred during logout.",
                data={},
                http_status=status.HTTP_400_BAD_REQUEST,
            )


class TokenRefreshView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [TokenRefreshRateThrottle]

    @swagger_auto_schema(
        operation_summary="Centralized Referesh Token EP",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['refresh_token'],
            properties={
                'refresh_token': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description="Refresh token",
                ),
            },
        ),
        responses={
            200: openapi.Response(description="SUCCESS."),
            400: openapi.Response(
                description="Bad Request.",
                examples={
                    "application/json": {
                        'message': 'Provide the description and message.',
                    },
                },
            ),
        },
    )
    def post(self, request):
        try:
            result = refresh_tokens(request=request)
            response = Response({
                "access_token": result['access_token'],
                "refresh_token": result['refresh_token'],
            }, status=200)
            set_auth_cookies(response, result['access_token'], result['refresh_token'])
            return response

        except TokenError as e:
            error_msg = str(e)
            if error_msg == "Refresh token expired":
                response = Response(
                    {'detail': error_msg},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
                clear_auth_cookies(response)
                return response
            return Response(
                {'message': error_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:  # noqa: BLE001 — top-level refresh: any failure must still return a structured 400 response
            logger.error(f"Refresh token error: {str(e)}")
            return Response({"message": "An error occurred"}, status=400)


class SessionView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_summary="Current authenticated session",
        responses={200: "Current user session"},
    )
    def get(self, request):
        return custom_response(
            status="OK",
            message="Session is active",
            data={'user': build_user_data(request.user)},
        )


# ─── Dashboard Views ─────────────────────────────────────────────────────────


class Overview(APIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def get(self, request, *args, **kwargs):
        force_refresh = request.query_params.get('refresh', '').lower() in ('1', 'true')
        # request.tenant_id is populated by TenantMiddleware /
        # CustomTokenAuthentication.apply_tenant_from_user. The selector fans
        # out to a ThreadPoolExecutor whose worker connections default to '-1'
        # (deny-all) — pass the tenant explicitly so each worker re-applies it.
        tenant_id = getattr(request, 'tenant_id', '-1')
        data = get_overview_data(force_refresh=force_refresh, tenant_id=tenant_id)
        return custom_response(
            status="OK",
            message="Data retrieved successfully",
            data=data,
        )


class NewsAPIView(APIView):
    """Returns program news/summaries for the ticker."""
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def get(self, request, *args, **kwargs):
        data = get_news_data()
        return Response(data, status=status.HTTP_200_OK)


# ─── Alert Views ─────────────────────────────────────────────────────────────


class AlertAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]
    serializer_class = AlertSerializer
    queryset = Alert.objects.all().order_by("-id")
    pagination_class = LargeResultsSetPagination
    filterset_class = AlertFilter
    filter_backends = [DjangoFilterBackend]

    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        queryset = self.queryset
        return Response({
            **response.data,
            "critical": queryset.filter(severity="critical").count(),
            "high": queryset.filter(severity="high").count(),
            "medium": queryset.filter(severity="medium").count(),
            "low": queryset.filter(severity="low").count(),
        })


class AlertResolveView(APIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def post(self, request, id, *args, **kwargs):
        alert = get_object_or_404(Alert, id=id)
        if alert.status != 'resolved':
            alert.status = 'resolved'
            alert.save()

        return custom_response(
            status="OK",
            message="Alert resolved",
            data={},
        )


class AlertAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, IsNotSupplierRole]

    def post(self, request, id, *args, **kwargs):
        alert = get_object_or_404(Alert, id=id)
        if alert.status != 'acknowledged':
            alert.status = 'acknowledged'
            alert.save()

        return custom_response(
            status="OK",
            message="Alert acknowledge",
            data={},
        )
