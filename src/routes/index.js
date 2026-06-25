import React from "react";
import { Navigate } from "react-router-dom";
import Login from "../components/pages/Login/Login";
import Dashboard from "../components/pages/Dashboard/Dashboard";
import SOPManager from "../components/pages/SOPManager/SOPManager";
import DuplicateDetection from "../components/pages/DuplicateDetection/DuplicateDetection";
import Simplification from "../components/pages/Simplification/Simplification";
import ProtectedRoute from "../components/common/ProtectedRoute/ProtectedRoute";
import NotFound from "../components/NotFound";
import Layout from "../components/common/Layout/Layout";

const PlaceholderPage = ({ title, description }) => (
  <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
    <h2>{title}</h2>
    <p style={{ color: "#64748b" }}>{description}</p>
  </div>
);

const routes = (user) => [
  { path: "/login", element: user ? <Navigate to="/dashboard" replace /> : <Login /> },
  { path: "/dashboard", element: <ProtectedRoute user={user}><Layout><Dashboard /></Layout></ProtectedRoute> },
  { path: "/sop-library", element: <ProtectedRoute user={user}><Layout><SOPManager /></Layout></ProtectedRoute> },
  { path: "/duplicates", element: <ProtectedRoute user={user}><Layout><DuplicateDetection /></Layout></ProtectedRoute> },
  { path: "/simplification", element: <ProtectedRoute user={user}><Layout><Simplification /></Layout></ProtectedRoute> },
  { path: "/monitoring", element: <ProtectedRoute user={user}><Layout><PlaceholderPage title="Regulatory Monitoring" description="Coming soon — SOP-to-regulation mapping, compliance tracking, and gap detection." /></Layout></ProtectedRoute> },
  { path: "/", element: <Navigate to={user ? "/dashboard" : "/login"} replace /> },
  { path: "*", element: <NotFound /> },
];

export default routes;
