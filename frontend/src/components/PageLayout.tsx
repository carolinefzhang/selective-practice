
import React from "react";
import Header from "./Header"

interface Props {
  children: React.ReactNode;
}

const PageLayout: React.FC<Props> = ({ children }) => {
  return (
    <div className="page-layout">
      <Header />
      <div className="page-layout__content">{children}</div>
    </div>
  );
};

export default PageLayout;
