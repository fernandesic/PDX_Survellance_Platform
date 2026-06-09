/**
 * HDIS-PRO — Presentational View
 * Clean layout: no inner tab bar (main sidebar handles navigation).
 */

import { Route, Routes } from "react-router-dom";
import ProDashboard from "@/pages/hdis/pages/ProDashboard";
import ProFeed from "@/pages/hdis/pages/ProFeed";
import ProAlerts from "@/pages/hdis/pages/ProAlerts";
import ProRecordDetail from "@/pages/hdis/pages/ProRecordDetail";
import ProCountries from "@/pages/hdis/pages/ProCountries";
import ProBriefings from "@/pages/hdis/pages/ProBriefings";
import "./hdis.css";

export const HdisView = () => {
  return (
    <div className="hdis-theme min-h-full">
      <main className="mx-auto max-w-screen-2xl px-6 py-6">
        <Routes>
          <Route index element={<ProDashboard />} />
          <Route path="feed" element={<ProFeed />} />
          <Route path="countries" element={<ProCountries />} />
          <Route path="alerts" element={<ProAlerts />} />
          <Route path="briefings" element={<ProBriefings />} />
          <Route path="record/:id" element={<ProRecordDetail />} />
        </Routes>
      </main>
    </div>
  );
};
