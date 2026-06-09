import { apiPost, apiGet, TokenManager } from "@/lib/api";
import type { LoginData, LoginResponse, SessionResponse } from "@/types/auth_type";
import { getBrowserSessionId } from "@/utils/session";

interface SSOInitResponse {
    status: string;
    message: string;
    data: { auth_url: string };
}

export const authService = {
    login: async (credentials: LoginData): Promise<LoginResponse> => {
        const browserSessionId = getBrowserSessionId();

        const response = await apiPost<LoginResponse>('/account/auth/login', {
            ...credentials,
            browser_session_id: browserSessionId,
        });

        TokenManager.setTokens({
            accessToken: response.data.access,
            refreshToken: response.data.refresh,
        });
        return response;
    },

    /** Start SSO flow — returns the Azure AD authorization URL */
    ssoInit: async (): Promise<SSOInitResponse> => {
        return await apiGet<SSOInitResponse>('/account/auth/sso/init');
    },

    logout: async (): Promise<void> => {
        try {
            await apiPost('/account/auth/logout');
        } finally {
            TokenManager.clearTokens();
        }
    },

    session: async (): Promise<SessionResponse> => {
        return await apiGet<SessionResponse>('/account/auth/session', { timeout: 10000 });
    },
};
