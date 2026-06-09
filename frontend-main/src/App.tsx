import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";

// Layouts, Contexts and Providers (Keep these synchronous)
import { ToastProvider } from "@/contexts/ToastProvider";
import MainLayout from "@/layouts/MainLayout";
import { LiveFeedWatchlistProvider } from "@/contexts/LiveFeedWatchlistContext";
import { AuthDataProvider } from "./contexts/AuthProvider";
import { NewsProvider } from "./contexts/NewsProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import SupplierLayout from "@/layouts/SupplierLayout";
import DepartmentLayout from "@/layouts/DepartmentLayout";
import SupplierProtectedRoute from "@/components/SupplierProtectedRoute";
import DepartmentProtectedRoute from "@/components/DepartmentProtectedRoute";
import ProtectedRoute from "@/components/ProtectedRoute";
const PIPLayout = lazy(() => import("./pages/pip/PIPLayout"));
import LoadingFallback from "@/components/usables/LoadingFallback";

// Lazy Loaded Pages
const Overview = lazy(() => import("@/pages/overview/index"));
const GlobalMap = lazy(() => import("@/pages/globalmap"));
const Login = lazy(() => import("@/pages/login"));
const IHR = lazy(() => import("@/pages/ihr/index"));
const StarData = lazy(() => import("@/pages/stardata/index"));
const Readiness = lazy(() => import("@/pages/readiness/index"));
const CHWDistribution = lazy(() => import("@/pages/chw/index"));
const AlertsManagement = lazy(() => import("@/pages/alerts/index"));
const AlertsV2 = lazy(() => import("@/pages/alerts-v2/index"));
const ChatPage = lazy(() => import("@/pages/chat"));
const PAMILocations = lazy(() => import("@/pages/pami/index"));
const OSLPage = lazy(() => import("@/pages/osl/index"));
const Climate = lazy(() => import("@/pages/climate/index"));
const IhmRef = lazy(() => import("@/pages/ihmref/index"));
const Simex = lazy(() => import("@/pages/simex/index"));
const HdisPage = lazy(() => import("@/pages/hdis/index"));
const PreparednessForm = lazy(() => import("./pages/preparedness-form"));
const PreparednessPage = lazy(() => import("./pages/preparedness/index"));
const SitrepForm = lazy(() => import("./pages/sitrep-form"));
const SitrepDashboard = lazy(() => import("./pages/sitrep/index"));
const SitrepView = lazy(() => import("./pages/sitrep/SitrepViewPage"));
const Predictions = lazy(() => import("./pages/predictions/index"));
const VerificationDashboard = lazy(() => import("./pages/verification/VerificationDashboard"));
const POE = lazy(() => import("./pages/poe/index"));
const OneHealth = lazy(() => import("./pages/one-health/index"));
const OCVPage = lazy(() => import("./pages/ocv/index"));
const GhanaPdx = lazy(() => import("@/pages/ghanaPdx/index"));
const OutbreakWorkspace = lazy(() => import("@/pages/outbreak"));
const UploadTracker = lazy(() => import("@/pages/admin/UploadTracker"));

// Form Pages
const AdminDashboard = lazy(() => import("@/pages/supplierForm/AdminDashboard"));
const PublicForm = lazy(() => import("@/pages/supplierForm/PoForm"));
const DepartmentAdminDashboard = lazy(() => import("@/pages/departmentForm/AdminDashboard"));
const DepartmentPublicForm = lazy(() => import("@/pages/departmentForm/DeptForm"));

// PIP Views
const PIPOverviewPage = lazy(() => import("./pages/pip/views/OverviewPage"));
const PIPIndicatorsPage = lazy(() => import("./pages/pip/views/PIPIndicatorsPage"));
const PIPSurveillancePage = lazy(() => import("./pages/pip/views/SurveillancePage"));
const PIPCountriesPage = lazy(() => import("./pages/pip/views/CountriesPage"));
const PIPVirologicalPage = lazy(() => import("./pages/pip/views/VirologicalPage"));
const PIPPreparednessPage = lazy(() => import("./pages/pip/views/PreparednessPage"));
const PIPHeatmapPage = lazy(() => import("./pages/pip/views/HeatmapPage"));
const PIPBulletinPage = lazy(() => import("./pages/pip/views/BulletinPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthDataProvider>
            <NewsProvider>
              <LiveFeedWatchlistProvider>
                <div className="min-h-screen">
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      {/* Public Login Route */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/preparedness-form" element={<PreparednessForm />} />
                      <Route path="/sitrep-form" element={<SitrepForm />} />

                      {/* Supplier Routes (Layout Wrapper Pattern) */}
                      <Route path="/supplier" element={<SupplierProtectedRoute />}>
                        <Route element={<SupplierLayout />}>
                          <Route index element={<PublicForm />} />
                          <Route path="admin" element={<AdminDashboard />} />
                        </Route>
                      </Route>

                      {/* Department Routes (Layout Wrapper Pattern) */}
                      <Route path="/department" element={<DepartmentProtectedRoute />}>
                        <Route element={<DepartmentLayout />}>
                          <Route index element={<DepartmentPublicForm />} />
                          <Route path="admin" element={<DepartmentAdminDashboard />} />
                        </Route>
                      </Route>

                      {/* Main Platform Routes (Global Protected Pattern) */}
                      <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<MainLayout />}>
                          <Route index element={<GlobalMap />} />
                          <Route path="overview" element={<Overview />} />
                          <Route path="ihr" element={<IHR />} />
                          <Route path="chw" element={<CHWDistribution />} />
                          <Route path="readiness" element={<Readiness />} />
                          <Route path="star_tracker" element={<StarData />} />
                          <Route path="alerts" element={<AlertsManagement />} />
                          <Route path="alerts-v2" element={<AlertsV2 />} />
                          <Route path="climate" element={<Climate />} />
                          <Route path="ihmref" element={<IhmRef />} />
                          <Route path="simex" element={<Simex />} />
                          <Route path="osl" element={<OSLPage />} />
                          <Route path="hdis/*" element={<HdisPage />} />
                          <Route path="preparedness" element={<PreparednessPage />} />
                          <Route path="sitrep" element={<SitrepDashboard />} />
                          <Route path="sitrep/view/:id" element={<SitrepView />} />
                          <Route path="predictions" element={<Predictions />} />
                          <Route path="verification" element={<VerificationDashboard />} />
                          <Route path="pami/*" element={<PAMILocations />} />
                          <Route path="poe/*" element={<POE />} />
                          <Route path="oneHealth/*" element={<OneHealth />} />
                          <Route path="ocv/*" element={<OCVPage />} />
                          <Route path="global-map" element={<GlobalMap />} />
                          <Route path="ghanaPdx" element={<GhanaPdx />} />
                          <Route path="outbreak/:id" element={<OutbreakWorkspace />} />
                          <Route path="admin/upload-tracker" element={<UploadTracker />} />
                          <Route path="chat" element={<ChatPage />} />

                          {/* PIP Dashboard Nested Routes */}
                          <Route path="pip/*" element={<PIPLayout />}>
                            <Route index element={<PIPOverviewPage />} />
                            <Route path="indicators" element={<PIPIndicatorsPage />} />
                            <Route path="surveillance" element={<PIPSurveillancePage />} />
                            <Route path="countries" element={<PIPCountriesPage />} />
                            <Route path="virological" element={<PIPVirologicalPage />} />
                            <Route path="preparedness" element={<PIPPreparednessPage />} />
                            <Route path="heatmap" element={<PIPHeatmapPage />} />
                            <Route path="bulletin" element={<PIPBulletinPage />} />
                          </Route>
                        </Route>
                      </Route>
                    </Routes>
                  </Suspense>
                </div>
              </LiveFeedWatchlistProvider>
            </NewsProvider>
          </AuthDataProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
