
import React from "react";
import { Header } from "./header"

interface Props {
  children: React.ReactNode;
}

export const PageLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="page-layout">
      <Header />
      <div className="page-layout__content">{children}</div>
    </div>
  );
};
