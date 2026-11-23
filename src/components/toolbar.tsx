import { Children } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { GlassSurface } from "./glass";
import { Icon } from "./ui";
import { useWorkspace, workspaceTransitions } from "./workspace";

export function WorkspaceToolbar({ title, back, details, children }: {
  title: string;
  back?: { to: string; label: string };
  details?: ReactNode;
  children?: ReactNode;
}) {
  const { toolbar } = useWorkspace();
  if (!toolbar) return null;
  const actions = Children.toArray(children);

  return createPortal(<>
    <div className="toolbar-leading">
      {back && <GlassSurface className="toolbar-back">
        <Link className="toolbar-icon" to={back.to} aria-label={back.label} title={back.label} viewTransition={workspaceTransitions}>
          <Icon name="back"/>
        </Link>
      </GlassSurface>}
      <div className="toolbar-title">
        <h1 title={title}>{title}</h1>
        {details && <div className="toolbar-details">{details}</div>}
      </div>
    </div>
    {actions.length > 0 && <div className="toolbar-actions">
      {actions.length > 1 ? <GlassSurface className="toolbar-action-group">{actions}</GlassSurface> : actions}
    </div>}
  </>, toolbar);
}
