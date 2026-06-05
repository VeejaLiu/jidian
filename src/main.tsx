import { createRoot } from "react-dom/client";
import { registerLocale } from "react-datepicker";
import { zhCN } from "date-fns/locale/zh-CN";
import { App } from "./App";
import "react-datepicker/dist/react-datepicker.css";
import "./styles.css";

registerLocale("zh-CN", zhCN);

const rootElement = document.querySelector("#root");

if (rootElement) {
  window.__fundDcaRoot = window.__fundDcaRoot || createRoot(rootElement);
  window.__fundDcaRoot.render(<App />);
}
