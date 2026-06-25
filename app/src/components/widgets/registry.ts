import React from "react";
import { WidgetAgenda } from "./WidgetAgenda";
import { WidgetAsk } from "./WidgetAsk";
import { WidgetFleet } from "./WidgetFleet";
import { WidgetOrbit } from "./WidgetOrbit";
import { WidgetHabits } from "./WidgetHabits";
import { WidgetWriting } from "./WidgetWriting";
import { WidgetHealth } from "./WidgetHealth";
import { WidgetHarness } from "./WidgetHarness";
import { WidgetSwarm } from "./WidgetSwarm";
import { WidgetCorrespondence } from "./WidgetCorrespondence";

export interface WidgetConfig {
  id: string;
  label: string;
  desc: string;
  component: React.ComponentType<any>;
}

export const WIDGET_REGISTRY: WidgetConfig[] = [
  { id: "ask", label: "Ask Rudder", desc: "Sovereign AI reality nodes search", component: WidgetAsk },
  { id: "agenda", label: "Agenda & Tasks", desc: "Upcoming schedule & quick checklist", component: WidgetAgenda },
  { id: "fleet", label: "Fleet Status", desc: "Cluster hardware telemetry nodes", component: WidgetFleet },
  { id: "orbit", label: "Sovereign Orbit", desc: "Knowledge graph database metrics", component: WidgetOrbit },
  { id: "habits", label: "Habits Checklist", desc: "Interactive checklist of active habits", component: WidgetHabits },
  { id: "writing", label: "Zenith Writing", desc: "Goals tracking & recent draft shortcuts", component: WidgetWriting },
  { id: "health", label: "Biometrics Telemetry", desc: "Steps, sleep, and heart rate telemetry", component: WidgetHealth },
  { id: "harness", label: "Context Harnesses", desc: "Sovereign context bundles for LLMs & swarms", component: WidgetHarness },
  { id: "swarm", label: "Sovereign Swarm", desc: "Multi-agent persona writing console", component: WidgetSwarm },
  { id: "correspondence", label: "Inbox & Correspondence", desc: "Automated decision ledger and voice-matched drafts", component: WidgetCorrespondence },
];
