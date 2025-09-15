import { useAuth0 } from "@auth0/auth0-react";
import React, { useState, } from "react";

const LogoutButton: React.FC = () => {
  const { logout } = useAuth0();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    logout({logoutParams: { returnTo: window.location.origin }});
  };

  return (
    <button onClick={handleLogout} disabled={isLoggingOut}>
      {isLoggingOut ? "Logging out..." : "Log Out"}
    </button>
  );
};

export default LogoutButton;