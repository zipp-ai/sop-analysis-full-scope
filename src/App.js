import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import supabase from "./supabase";
import routes from "./routes";
import { Toaster } from "sonner";
import LoadingSpinner from "./components/common/LoadingSpinner/LoadingSpinner";
import AutoLogout from "./components/common/AutoLogout/AutoLogout";
import URLParamChecker from "./components/common/URLParamChecker/URLParamChecker";
import { autoLogoutMinutes } from "./constants/constants";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <LoadingSpinner />
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <URLParamChecker>
        {user && <AutoLogout timeoutMinutes={autoLogoutMinutes} />}
        <Routes>
          {routes(user).map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
        </Routes>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          expand={true}
          visibleToasts={5}
          gap={12}
          toastOptions={{
            duration: 2000,
            style: {
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow:
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              marginBottom: "8px",
            },
          }}
        />
      </URLParamChecker>
    </Router>
  );
}

export default App;
