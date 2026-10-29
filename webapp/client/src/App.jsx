import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Shell from "./components/Shell.jsx";
import { Skeleton } from "./components/ui.jsx";
import { useApp } from "./context.jsx";
import Login from "./pages/Login.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Predict = lazy(() => import("./pages/Predict.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const Retention = lazy(() => import("./pages/Retention.jsx"));
const Batch = lazy(() => import("./pages/Batch.jsx"));
const Models = lazy(() => import("./pages/Models.jsx"));
const History = lazy(() => import("./pages/History.jsx"));

export default function App() {
  const { user, booting } = useApp();
  if (booting) return <div style={{ padding: 40 }}><Skeleton h={200} /></div>;
  if (!user) return <Login />;
  return (
    <Shell>
      <Suspense fallback={<div className="page"><Skeleton h={140} /><Skeleton h={320} /></div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/retention" element={<Retention />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="/models" element={<Models />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
