import { memo } from "react";
import type { ReactNode } from "react";
import LiquidGlass from "liquid-glass-react";

type GlassKind = "capsule" | "sidebar" | "menu";
const still = { x: 0, y: 0 };

const GlassLayer = memo(function GlassLayer({ kind }: { kind: GlassKind }) {
  return <div className="glass-layer" aria-hidden="true">
    {kind !== "sidebar" && <LiquidGlass className="glass-refraction"
      displacementScale={32}
      blurAmount={0.55}
      saturation={130}
      aberrationIntensity={0.4}
      elasticity={0}
      globalMousePos={still}
      mouseOffset={still}
      mode="prominent"
      padding="0"
      style={{ position: "absolute", width: "100%", height: "100%", top: "50%", left: "50%" }}>
      <span className="glass-sizing"/>
    </LiquidGlass>}
  </div>;
});

export function GlassSurface({ children, className, kind = "capsule" }: {
  children: ReactNode;
  className?: string;
  kind?: GlassKind;
}) {
  return <div className={`glass-surface glass-${kind}${className ? ` ${className}` : ""}`}>
    <GlassLayer kind={kind}/>
    <div className="glass-content">{children}</div>
  </div>;
}
