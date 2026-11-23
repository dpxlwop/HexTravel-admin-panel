import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { router } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Не найден контейнер приложения.");

createRoot(root).render(<RouterProvider router={router}/>);
