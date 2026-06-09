import { useState, useEffect } from "react";
import type { FormEvent, ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/contexts/ToastProvider";
import { useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { authService } from "@/services/auth_service";
import type { LoginData } from "@/types/auth_type";
import { validateEmail, validatePassword } from "@/utils";
import { Loading } from "@/components/Loading";

// SSO error messages (mapped from backend redirect query params)
const SSO_ERROR_MESSAGES: Record<string, string> = {
  session_expired: "SSO session expired. Please try again.",
  provider_error: "Authentication provider returned an error. Please try again.",
  auth_failed: "SSO authentication failed. Please contact your administrator.",
  internal_error: "An unexpected error occurred during SSO login.",
};

export default function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, set: setUserData, isAuthChecking } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [form, setForm] = useState<LoginData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Partial<LoginData>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [ssoLoading, setSsoLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Show SSO error from callback redirect (e.g. ?sso_error=auth_failed)
  useEffect(() => {
    const ssoError = searchParams.get("sso_error");
    if (ssoError) {
      const message = SSO_ERROR_MESSAGES[ssoError] || "SSO login failed. Please try again.";
      showToast(message, "error", 7000);
      // Clean up the URL
      searchParams.delete("sso_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  if (isAuthChecking) {
    return <Loading />;
  }

  if (user) {
    if (user.role === 'supplier') {
      return <Navigate to="/supplier/admin" replace />;
    }
    if (user.role === 'department') {
      return <Navigate to="/department/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  const validateForm = (): boolean => {
    const errs: Partial<LoginData> = {};
    const emailErr = validateEmail(form.email)
    if (emailErr) errs.email = emailErr
    const pwdErr = validatePassword(form.password)
    if (pwdErr) errs.password = pwdErr
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Get the 'next' parameter from query string
  const redirectTo = new URLSearchParams(window.location.search).get('next') || '/';
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setLoading(true);
      const response = await authService.login(form);
      setUserData(response.data.user)
      // Redirect supplier users to supplier admin, others to default
      if (response.data.user.role === 'supplier') {
        navigate('/supplier/admin');
      } else if (response.data.user.role === 'department') {
        navigate('/department/admin');
      } else {
        navigate(redirectTo);
      }
      showToast(response.message, "success", 5000);
    } catch (err: any) {
      showToast(err?.message || 'Unknown error.', "error", 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async () => {
    try {
      setSsoLoading(true);
      const response = await authService.ssoInit();
      // Redirect browser to Azure AD login page
      window.location.href = response.data.auth_url;
    } catch (err: any) {
      showToast(err?.message || "Failed to start SSO login.", "error", 5000);
      setSsoLoading(false);
    }
    // Note: no finally — if redirect succeeds, component unmounts
  };

  const handleInput =
    (field: keyof LoginData) =>
      (e: ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [field]: e.target.value });
      };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-[#0B1221] text-white px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="WHO Logo"
            className="w-36 mx-auto mb-4"
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-8 rounded-xl shadow-md"
        >
          <h3 className="text-center text-lg mb-6">
            Login in to your account
          </h3>

          {/* ── SSO Login Button ────────────────────────────────── */}
          <button
            type="button"
            onClick={handleSSOLogin}
            disabled={ssoLoading || loading}
            id="sso-login-button"
            className="w-full py-3 rounded-lg border border-gray-600 bg-[#0D1527]
                       hover:bg-[#1a2744] hover:border-blue-500
                       transition-all duration-200 flex items-center justify-center gap-3
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ssoLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="text-sm">Connecting to WHO...</span>
              </>
            ) : (
              <>
                {/* Microsoft logo SVG */}
                <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                <span className="text-sm">Sign in with WHO / Microsoft</span>
              </>
            )}
          </button>

          {/* ── Divider ────────────────────────────────────────── */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-xs uppercase tracking-wider">or sign in with email</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <label className="block text-sm mb-1">Email address</label>
          <input
            type="email"
            className="w-full px-4 py-3 bg-[#0D1527] rounded-lg outline-none border border-gray-700 focus:border-blue-500"
            value={form.email}
            onChange={handleInput("email")}
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email}</p>
          )}

          <label className="block text-sm mt-4 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full px-4 py-3 bg-[#0D1527] rounded-lg outline-none border border-gray-700 focus:border-blue-500"
              value={form.password}
              onChange={handleInput("password")}
            />

            <span
              className="absolute right-3 top-3 cursor-pointer text-gray-400"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </span>
          </div>
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password}</p>
          )}


          <button
            type="submit"
            disabled={loading || ssoLoading}
            className="mt-6 w-full py-3 rounded-lg bg-blue-900 hover:bg-blue-800 transition disabled:opacity-50"
          >
            {loading ? "Loading..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
