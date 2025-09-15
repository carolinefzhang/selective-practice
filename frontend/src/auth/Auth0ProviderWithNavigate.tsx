import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import React, { type PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";

interface Auth0ProviderWithNavigateProps {
  children: React.ReactNode;
}

const Auth0ProviderWithNavigate = ({
  children,
}: PropsWithChildren<Auth0ProviderWithNavigateProps>): React.ReactNode | null => {
  const navigate = useNavigate();

  const domain: string = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId: string = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const redirectUri: string = import.meta.env.VITE_AUTH0_REDIRECT_URI;

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo || window.location.pathname);
  };

  if (!(domain && clientId && redirectUri)) {
    return (
      <div>
        <h1>Configuration Error</h1>
        <p>Missing Auth0 environment variables:</p>
        <ul>
          {!domain && <li>VITE_AUTH0_DOMAIN</li>}
          {!clientId && <li>VITE_AUTH0_CLIENT_ID</li>}
          {!redirectUri && <li>VITE_AUTH0_REDIRECT_URI</li>}
        </ul>
      </div>
    );
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        scope: "openid email profile",
        response_type: "token id_token",
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0ProviderWithNavigate;