
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import StartupSetup from "./pages/StartupSetup";
import ICPBuilder from "./pages/ICPBuilder";
import ICPReview from "./pages/ICPReview";
import BookingSetup from "./pages/BookingSetup";
import ApolloSetup from "./pages/ApolloSetup";
import Dashboard from "./pages/Dashboard";
import Prospects from "./pages/Prospects";
import ProspectIntelligence from "./pages/ProspectIntelligence";
import Leads from "./pages/Leads";
import DecisionMakers from "./pages/DecisionMakers";
import Outreach from "./pages/Outreach";
import FollowUps from "./pages/FollowUps";
import NextBestAction from "./pages/NextBestAction";
import Pipeline from "./pages/Pipeline";
import SettingsPage from "./pages/SettingsPage";
import Reports from "./pages/Reports";
import { usePrototype } from "./context/PrototypeContext";

const onboardingPaths = [
  "/startup-setup",
  "/icp-builder",
  "/icp-review",
  "/booking-setup",
  "/apollo-setup"
];

function FlowGate({ children }) {
  const {
    setupComplete,
    icp,
    icpApproved,
    bookingUrl,
    apolloConnectionStatus
  } = usePrototype();

  const location = useLocation();

  const hasBookingUrl = (() => {
    try {
      return new URL(bookingUrl).protocol === "https:";
    } catch {
      return false;
    }
  })();

  const requiredPath = !setupComplete
    ? "/startup-setup"
    : !icp
      ? "/icp-builder"
      : !icpApproved
        ? "/icp-review"
        : !hasBookingUrl
          ? "/booking-setup"
          : apolloConnectionStatus !== "demo_connected"
            ? "/apollo-setup"
            : null;

  const currentStep = onboardingPaths.indexOf(location.pathname);
  const requiredStep = onboardingPaths.indexOf(requiredPath);

  if (
    requiredPath &&
    (currentStep === -1 || currentStep > requiredStep)
  ) {
    return <Navigate to={requiredPath} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/startup-setup"
        element={<FlowGate><StartupSetup /></FlowGate>}
      />
      <Route
        path="/icp-builder"
        element={<FlowGate><ICPBuilder /></FlowGate>}
      />
      <Route
        path="/icp-review"
        element={<FlowGate><ICPReview /></FlowGate>}
      />
      <Route
        path="/booking-setup"
        element={<FlowGate><BookingSetup /></FlowGate>}
      />
      <Route
        path="/apollo-setup"
        element={<FlowGate><ApolloSetup /></FlowGate>}
      />

      <Route element={<FlowGate><AppLayout /></FlowGate>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/prospects" element={<Prospects />} />
        <Route path="/prospects/:id" element={<ProspectIntelligence />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/decision-makers" element={<DecisionMakers />} />
        <Route path="/outreach" element={<Outreach />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/next-best-action" element={<NextBestAction />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
