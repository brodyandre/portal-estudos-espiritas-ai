import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { redirectLegacyHashRoute } from "./routing/legacyHashRedirect";
import "./styles/tokens.css";
import "./styles/global.css";

redirectLegacyHashRoute(window.location, window.history, import.meta.env.BASE_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
