// filepath: frontend/src/App.tsx
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import HomePage from "./pages/home-page";
import PageLoader from "./components/page-loader";
import { AuthenticationGuard } from "./auth/authentication-guard";
import { CallbackPage } from "./pages/callback-page";
import { NotFoundPage } from "./pages/not-found-page";
import { Routes, Route } from "react-router-dom";

export const App: React.FC = () => {
  const { isLoading, error } = useAuth0();

  if (error) {
    return (
      <div>
        <h1>Auth0 Error</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-layout">
        <PageLoader />
      </div>
    );
  }
  return (
    <Routes>
      <Route
        path="/"
        element={<AuthenticationGuard component={HomePage} />}
      />
      <Route path="/callback" element={<CallbackPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
