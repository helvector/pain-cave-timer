import { parse as parseHtml, type HTMLElement } from "node-html-parser";
import type { StepNode, WorkoutNode } from "./types";
import { parseDuration } from "./duration";
import { parseStepLine } from "./step";
import { parseHeartRateTarget, type TargetOptions } from "./target";

/** One day's section of a TrainingPeaks "Schedule for …" email, before expansion. */
export interface RawDay {
  dateText: string; // "Thursday, September 10"
  title: string;
  isRestDay: boolean;
  plannedSec?: number;
  tss?: number;
  description?: string;
  nodes: WorkoutNode[];
  unparsed: string[];
  warnings: string[];
  /** Counter for multi-step interval groups within this day. */
  groupSeq: number;
}

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];

function text(el: HTMLElement | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Pull each day's workout structure out of the email HTML.
 * Anchors on the markup TrainingPeaks uses: h1.formattedDate per day,
 * h2 title, "Time"/"TSS" headers, and an <ol> of steps each with a
 * .structureTitle and target spans.
 */
export function extractDays(html: string, opts: TargetOptions = {}): RawDay[] {
  const root = parseHtml(html, { comment: false });
  const days: RawDay[] = [];

  for (const h1 of root.querySelectorAll("h1.formattedDate, h1")) {
    const dateText = text(h1);
    if (!/^[a-z]+,\s*[a-z]+\s+\d{1,2}$/i.test(dateText)) continue;
    const container = closest(h1, "dayBlockContainer") ?? h1.parentNode;
    if (!container) continue;

    const title = text(container.querySelector("h2")) || "Untitled workout";
    const isRestDay = /^rest\s*day$/i.test(title);
    const day: RawDay = { dateText, title, isRestDay, nodes: [], unparsed: [], warnings: [], groupSeq: 0 };

    // "Time" and "TSS" sit as <p>label</p><h3>value</h3> pairs.
    for (const p of container.querySelectorAll("p")) {
      const label = text(p).toLowerCase();
      if (label !== "time" && label !== "tss") continue;
      const h3 = p.parentNode?.querySelector("h3");
      const value = text(h3);
      if (label === "time") day.plannedSec = parseDuration(value);
      else if (label === "tss") day.tss = Number(value) || undefined;
    }

    // "Description" is a label <p> followed by a sibling <p> with the body.
    for (const p of container.querySelectorAll("p")) {
      if (text(p).toLowerCase() !== "description") continue;
      const body = p.nextElementSibling;
      if (body) day.description = paragraphText(body);
      break;
    }

    const ol = container.querySelector("ol");
    if (ol) day.nodes = parseList(ol, day, opts);
    else if (!isRestDay) day.warnings.push("No structured steps found in the email for this day.");

    days.push(day);
  }
  return days;
}

/** Text with <br> runs turned into newlines, trimmed. */
function paragraphText(el: HTMLElement): string {
  return el.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Repeat 4 times", "4x", "4 sets", "Repeat 3" → the count; undefined otherwise. */
export function parseRepeatCount(title: string | undefined): number | undefined {
  if (!title) return undefined;
  const m = title.match(/^\s*(?:repeat\s+(\d+)\s*(?:x|×|times?)?|(\d+)\s*(?:x|×|times|sets|rounds|reps))\s*$/i);
  const n = m ? Number(m[1] ?? m[2]) : undefined;
  return n && n > 1 ? n : undefined;
}

function isInside(el: HTMLElement, ancestor: HTMLElement): boolean {
  let cur: HTMLElement | null = el.parentNode;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parentNode;
  }
  return false;
}

function closest(el: HTMLElement, className: string): HTMLElement | undefined {
  let cur: HTMLElement | null = el.parentNode;
  while (cur) {
    if (cur.classList?.contains(className)) return cur;
    cur = cur.parentNode;
  }
  return undefined;
}

function parseList(ol: HTMLElement, day: RawDay, opts: TargetOptions): WorkoutNode[] {
  const nodes: WorkoutNode[] = [];
  for (const li of ol.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === "LI")) {
    const title = text(li.querySelector(".structureTitle")) || undefined;

    // A nested <ul> of steps means one of two things, told apart by the title:
    //  - "Repeat 4 times": the listed steps are ridden 4 times over;
    //  - anything else ("Ramp up in 4 steps" over-unders): one interval made
    //    of those steps, ridden once.
    // Each sub-step may carry its own label span ("Steady State", "Recovery").
    const subList = li.querySelector("ul");
    if (subList) {
      const subItems = subList.childNodes.filter((n): n is HTMLElement => (n as HTMLElement).tagName === "LI");
      const repeatCount = parseRepeatCount(title);
      const id = repeatCount ? undefined : ++day.groupSeq;
      const children: StepNode[] = [];
      subItems.forEach((sub, k) => {
        const subSpans = sub.querySelectorAll("span").map((sp) => text(sp)).filter(Boolean);
        const subNotes = subSpans.find((sp) => /^notes?\b/i.test(sp));
        // A leading span with no digits is the step's own label.
        const label = subSpans[0] && !/\d/.test(subSpans[0]) ? subSpans[0] : undefined;
        const subLine = subSpans.filter((sp) => sp !== subNotes && sp !== label).join(" ");
        const { step, leftovers } = parseStepLine(subLine, opts, label ?? (repeatCount ? undefined : title));
        if (!step) {
          day.unparsed.push(`${title ?? ""}: ${subLine}`.trim());
          return;
        }
        const node: StepNode = {
          ...step,
          notes: subNotes?.replace(/^notes?\s*[-:]?\s*/i, ""),
          group: id === undefined ? undefined : { id, part: k + 1, parts: subItems.length },
        };
        if (node.notes && !node.target.hrBpm && !node.target.hrPctThr) {
          const hr = parseHeartRateTarget(node.notes, opts);
          if (hr) node.target = { ...node.target, ...hr };
        }
        children.push(node);
        day.unparsed.push(...leftovers.map((l) => `${title ?? ""}: ${l}`.trim()));
      });
      if (repeatCount) nodes.push({ type: "repeat", count: repeatCount, children, raw: title ?? "" });
      else nodes.push(...children);
      continue;
    }

    const nested = li.querySelector("ol");
    const spans = li
      .querySelectorAll("span")
      .filter((s) => !nested || !isInside(s, nested))
      .map((s) => text(s))
      .filter(Boolean);
    const notes = spans.find((s) => /^notes?\b/i.test(s));
    const line = spans.filter((s) => s !== notes).join(" ");

    if (nested) {
      // Hypothetical repeat block: title like "3 x" or "Repeat 3 times".
      const m = (title + " " + line).match(/(\d+)\s*(?:x|×|times|sets|rounds)/i);
      const count = m ? Number(m[1]) : 1;
      if (!m) day.warnings.push(`Repeat group "${title ?? line}" has no count; assuming 1.`);
      nodes.push({ type: "repeat", count, children: parseList(nested, day, opts), raw: `${title ?? ""} ${line}`.trim() });
      continue;
    }

    const { step, leftovers } = parseStepLine(line, opts, title);
    if (step) {
      const node: StepNode = { ...step, notes: notes?.replace(/^notes?\s*[-:]?\s*/i, "") };
      if (node.notes && !node.target.hrBpm && !node.target.hrPctThr) {
        const hr = parseHeartRateTarget(node.notes, opts);
        if (hr) node.target = { ...node.target, ...hr };
      }
      nodes.push(node);
      day.unparsed.push(...leftovers.map((l) => `${title ?? ""}: ${l}`.trim()));
    } else {
      day.unparsed.push(`${title ?? ""} ${line}`.trim());
    }
  }
  return nodes;
}

/**
 * "Thursday, September 10" → "2026-09-10". The year comes from the subject
 * ("Schedule for Thursday 09/10/2026 to …") when it matches, else from the
 * received date, with a nudge across New Year.
 */
export function resolveDate(dateText: string, subject?: string, receivedAt?: Date): string | undefined {
  const m = dateText.match(/^[a-z]+,\s*([a-z]+)\s+(\d{1,2})$/i);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  const dayNum = Number(m[2]);
  if (!month) return undefined;

  for (const s of subject?.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g) ?? []) {
    if (Number(s[1]) === month && Number(s[2]) === dayNum) return iso(Number(s[3]), month, dayNum);
  }
  const base = receivedAt ?? new Date();
  let year = base.getUTCFullYear();
  if (month < base.getUTCMonth() + 1 - 6) year += 1; // email in December for a January workout
  return iso(year, month, dayNum);
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
