import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import TestPage from "./TestPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TestPage />
  </StrictMode>
);
