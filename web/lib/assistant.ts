import type { LiveData } from "@/lib/live-data";
import { formatTime, timeAgo } from "@/lib/utils";
import type { ForceId } from "@/types";

/**
 * Website-side demo assistant. There is no question-answering endpoint in the backend
 * (backend/API.md), so answers are composed locally. When the API is reachable, tide and
 * alert questions are answered from real read-only data and labeled as such.
 */
export interface AssistantAnswer {
  text: string[];
  provenance: "demo" | "live" | "unavailable";
  sources: string[];
  force: ForceId | null;
  suggestApp?: boolean;
}

const has = (q: string, words: string[]) => words.some((w) => q.includes(w));

export function detectForce(q: string): ForceId | null {
  const s = q.toLowerCase();
  if (has(s, ["flood", "water", "tide", "rain", "surge", "submerged", "tsunami", "storm drain"])) return "water";
  if (has(s, ["wind", "storm", "hurricane", "gust", "tornado", "air"])) return "air";
  if (has(s, ["tree", "power line", "powerline", "erosion", "road", "sinkhole", "land"])) return "land";
  if (has(s, ["fire", "smoke", "heat", "burn", "wildfire", "hot"])) return "fire";
  return null;
}

export function answer(question: string, live: LiveData, hasImage: boolean): AssistantAnswer {
  const q = question.toLowerCase().trim();
  const force = detectForce(q) ?? (hasImage ? "water" : null);

  if (hasImage) {
    return {
      provenance: "demo",
      force,
      suggestApp: true,
      sources: ["4forces app · POST /api/reports (Gemma 4)"],
      text: [
        "This page doesn't analyze or upload your photo — it stays in your browser.",
        "To have it analyzed, submit it as a report in the 4forces app. Gemma 4 estimates the hazard type, severity, flood depth in inches and whether cars can pass, and three confident reports nearby within an hour raise a neighborhood alert.",
        "If water is over the curb or moving, treat it as dangerous. Never walk or drive through flood water.",
      ],
    };
  }

  if (has(q, ["watch", "warning", "advisory"]) && has(q, ["differ", "vs", "versus", "between", "mean", "what is"])) {
    return {
      provenance: "demo",
      force: "water",
      sources: ["National Weather Service definitions"],
      text: [
        "A **watch** means conditions are favorable for the hazard — be prepared and keep checking.",
        "A **warning** means the hazard is happening or about to — act now.",
        "An **advisory** covers less serious conditions that are still a nuisance or risk, like minor coastal flooding at high tide.",
      ],
    };
  }

  if (has(q, ["alert", "active", "happening", "near me", "right now"])) {
    if (live.latestAlert.status === "ok") {
      const a = live.latestAlert.data;
      return a
        ? {
            provenance: "live",
            force: a.type === "flood" ? "water" : a.type === "fire" ? "fire" : a.type === "storm_damage" ? "air" : "land",
            suggestApp: true,
            sources: [`4forces alerts · created ${timeAgo(a.created_at)}${a.test ? " · test alert" : ""}`],
            text: [
              `Latest 4forces alert${a.test ? " (a test alert)" : ""}: ${a.message.en ?? `${a.type} near ${a.area}`}`,
              `Level: ${a.level}. Based on ${a.count} neighbor report${a.count === 1 ? "" : "s"} near ${a.area || "the reported location"}.`,
              "4forces alerts come from neighbor reports, not official warnings. For official alerts, follow the National Weather Service and Miami-Dade emergency management.",
            ],
          }
        : {
            provenance: "live",
            force,
            sources: ["4forces alerts"],
            text: [
              "There are no 4forces neighborhood alerts right now.",
              "That only covers alerts raised from neighbor reports. Official watches and warnings come from the National Weather Service.",
            ],
          };
    }
    return {
      provenance: "unavailable",
      force,
      suggestApp: true,
      sources: [],
      text: [
        "I can't reach the 4forces alert service from this page right now, so I can't tell you what's active.",
        "Open the app for the live map, or check the National Weather Service for official alerts.",
      ],
    };
  }

  if (force === "water" || has(q, ["neighborhood", "street", "biscayne", "brickell", "my area"])) {
    if (live.tide.status === "ok") {
      const t = live.tide.data;
      return {
        provenance: "live",
        force: "water",
        suggestApp: true,
        sources: [`NOAA CO-OPS ${t.station} via 4forces API · updated ${formatTime(t.updated_at)}${t.stale ? " (stale)" : ""}`],
        text: [
          `Tidal flood risk right now is **${t.risk}** at ${t.station}${t.king_tide_window ? ", and we're in a king-tide window" : ""}.`,
          t.next_high
            ? `Next high tide: ${formatTime(t.next_high.time)} at ${t.next_high.height_ft.toFixed(2)} ft. Low-lying streets near the bay flood first around high tide.`
            : "No upcoming high tide was returned.",
          "Tides tell you about tidal flooding, not rain. For your exact street, check neighbor reports on the app's live map.",
        ],
      };
    }
    return {
      provenance: "demo",
      force: "water",
      suggestApp: true,
      sources: ["Demo answer — live tide data not connected"],
      text: [
        "In Miami, street flooding usually comes from heavy rain overwhelming drains, or from high and king tides pushing water up through storm drains in low-lying areas near the bay.",
        "When the 4forces API is connected, this answer uses live NOAA tide data for Virginia Key. Right now it isn't, so I can't assess your street.",
        "Never walk or drive through flood water — it's often deeper than it looks.",
      ],
    };
  }

  if (force === "air") {
    return {
      provenance: "demo",
      force,
      sources: ["Demo answer — wind data not yet integrated"],
      text: [
        "4forces doesn't connect to wind measurements yet, so I can't say whether the wind is getting stronger.",
        "Today the system tracks storm damage that neighbors report — downed branches, debris, damaged roofs. Wind and official NWS watches and warnings are next on the roadmap.",
        "For current wind conditions, use the National Weather Service Miami forecast.",
      ],
    };
  }

  if (force === "land") {
    return {
      provenance: "demo",
      force,
      suggestApp: true,
      sources: ["Demo answer"],
      text: [
        "Downed trees and power lines are reported and mapped through the app; three confident reports close together raise an alert.",
        "Keep well away from a downed power line and assume it is live. Report it to the utility and 911.",
      ],
    };
  }

  if (force === "fire") {
    return {
      provenance: "demo",
      force,
      suggestApp: true,
      sources: ["Demo answer"],
      text: [
        "4forces can classify fire and smoke from neighbors' photos and text reports. Heat-index and wildfire data aren't connected yet.",
        "If you see an active fire, call 911 first — reporting in the app helps neighbors, it doesn't replace emergency services.",
      ],
    };
  }

  return {
    provenance: "demo",
    force: null,
    sources: ["Demo answer"],
    text: [
      "4forces watches four forces over one city: water, air, land and fire.",
      "Neighbors report what they see, AI reads each report, and clusters of confident reports become local alerts — on a live map, in the app, and out loud through a neighborhood speaker.",
      "Try asking about flooding, the tide, active alerts, or the difference between a watch and a warning.",
    ],
  };
}
