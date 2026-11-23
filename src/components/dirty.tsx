import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBlocker } from "react-router";
import { Confirm } from "./ui";

interface Edits {
  sections: string[];
  mark: (key: string, section: string | null) => void;
  allowNavigation: () => void;
}

const EditsContext = createContext<Edits | null>(null);

export function EditBoundary({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const skip = useRef(false);
  const mark = useCallback((key: string, section: string | null) => {
    setDrafts((current) => {
      if (current[key] === section || (!section && !(key in current))) return current;
      const next = { ...current };
      if (section) next[key] = section;
      else delete next[key];
      return next;
    });
  }, []);
  const allowNavigation = useCallback(() => { skip.current = true; }, []);
  const sections = Object.values(drafts);
  const dirty = sections.length > 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skip.current) {
      skip.current = false;
      return false;
    }
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return <EditsContext.Provider value={{ sections, mark, allowNavigation }}>
    {children}
    {blocker.state === "blocked" && <Confirm
      title="Уйти со страницы?"
      text="На этой странице есть несохранённые изменения."
      action="Уйти"
      close={blocker.reset}
      confirm={blocker.proceed}
      danger
    />}
  </EditsContext.Provider>;
}

export function useEdits() {
  const context = useContext(EditsContext);
  if (!context) throw new Error("Редактор должен быть открыт внутри панели.");
  return context;
}

export function useDirty(key: string, section: string, dirty: boolean) {
  const { mark } = useEdits();
  useEffect(() => {
    mark(key, dirty ? section : null);
    return () => mark(key, null);
  }, [key, section, dirty, mark]);
}
