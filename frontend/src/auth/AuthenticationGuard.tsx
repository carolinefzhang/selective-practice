import { withAuthenticationRequired } from "@auth0/auth0-react";
import React, { type ComponentType } from "react";
import PageLoader from "../components/PageLoader";

interface AuthenticationGuardProps {
  component: ComponentType;
}

const AuthenticationGuard: React.FC<AuthenticationGuardProps> = ({
  component,
}) => {
  const Component = withAuthenticationRequired(component, {
    onRedirecting: () => (
      <div className="page-layout">
        <PageLoader />
      </div>
    ),
  });

  return <Component />;
};

export default AuthenticationGuard;