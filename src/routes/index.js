import React from "react";
import { Navigate } from "react-router-dom";
import Login from "../components/pages/Login/Login";
import Dashboard from "../components/pages/Dashboard/Dashboard";
import ProfileSettings from "../components/pages/ProfileSettings/ProfileSettings";
import SOPLibrary from "../components/pages/SOPLibrary/SOPLibrary";
import DuplicateDetection from "../components/pages/DuplicateDetection/DuplicateDetection";
import ProtectedRoute from "../components/common/ProtectedRoute/ProtectedRoute";
import NotFound from "../components/NotFound";
import Layout from "../components/common/Layout/Layout";

const routes = (user) => [
  {
    path: "/login",
    element: user ? <Navigate to="/dashboard" replace /> : <Login />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute user={user}>
        <Layout>
          <Dashboard />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute user={user}>
        <Layout>
          <ProfileSettings />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/sop-library",
    element: (
      <ProtectedRoute user={user}>
        <Layout>
          <SOPLibrary />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/duplicates",
    element: (
      <ProtectedRoute user={user}>
        <Layout>
          <DuplicateDetection />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/simplification",
    element: (
      <ProtectedRoute user={user}>
        <Layout>
          <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
            <h2>Simplification</h2>
            <p style={{ color: "#64748b" }}>Coming soon — Actionability scoring, flowchart generation, and readability analysis.</p>
          </div>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/monitoring",
    element: (
      <ProtectedRoute user={user}>
        <Layout>
          <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
            <h2>Regulatory Monitoring</h2>
            <p style={{ color: "#64748b" }}>Coming soon — SOP-to-regulation mapping, compliance tracking, and gap detection.</p>
          </div>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: <Navigate to={user ? "/dashboard" : "/login"} replace />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
