import type { RepeatNode, StepNode, WorkoutNode } from "./types";
import { parseStepLine } from "./step";
import type { TargetOptions } from "./target";

export interface TextParse {
  nodes: WorkoutNode[];
  unparsed: string[];
}

const REPEAT_BLOCK = /^(?:(\d+)\s*[x×]|repeat\s+(\d+)(?:\s*(?:x|times))?|(\d+)\s*(?:sets|rounds|reps|times)(?:\s+of)?)\s*[:(]?\s*$/i;
const REPEAT_INLINE = /^(?:(\d+)\s*[x×]|repeat\s+(\d+)\s*(?:x|times)?\s*(?:of)?|(\d+)\s*(?:sets|rounds|reps)\s+of)\s*[:(]?\s*(.+?)\)?\s*$/i;
const LIST_MARKER = /^\s*(?:\d+[.)]|[-•*])\s+/;
const STANDALONE_NUMBER = /^\s*\d+[.)]?\s*$/;

interface Line {
  indent: number;
  text: string;
}

function lines(text: string): Line[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => {
      const indent = l.match(/^\s*/)?.[0].length ?? 0;
      return { indent, text: l.replace(LIST_MARKER, "").trim() };
    });
}

/**
 * Parse coach-typed or plain-text workout structure into a tree.
 * Understands the numbered TrainingPeaks plain-text form (title on one
 * line, step on the next), indented repeat groups ("3x" then children),
 * and inline repeats ("3x (5 min @ Z4, 5 min @ Z1)").
 */
export function parseWorkoutText(text: string, opts: TargetOptions = {}): TextParse {
  const ls = lines(text);
  const unparsed: string[] = [];
  let i = 0;

  function parseBlock(minIndent: number, stopAtBlank: boolean): WorkoutNode[] {
    const nodes: WorkoutNode[] = [];
    let pendingTitle: string | undefined;
    while (i < ls.length) {
      const { indent, text } = ls[i];
      if (!text) {
        i++;
        if (stopAtBlank && nodes.length > 0) break;
        continue;
      }
      if (indent < minIndent) break;
      if (STANDALONE_NUMBER.test(text)) { i++; continue; }

      const block = text.match(REPEAT_BLOCK);
      if (block) {
        const count = Number(block[1] ?? block[2] ?? block[3]);
        i++;
        // Children: following lines that are more indented; else until a blank line.
        const next = ls.slice(i).find((l) => l.text);
        const nested = next !== undefined && next.indent > indent;
        const children = nested ? parseBlock(indent + 1, false) : parseBlock(indent, true);
        nodes.push({ type: "repeat", count, children, raw: text } satisfies RepeatNode);
        pendingTitle = undefined;
        continue;
      }

      const inline = text.match(REPEAT_INLINE);
      if (inline && /\d/.test(inline[4])) {
        const count = Number(inline[1] ?? inline[2] ?? inline[3]);
        const children: WorkoutNode[] = [];
        for (const piece of inline[4].split(/\s*(?:,|;|\/|\bthen\b)\s*/i)) {
          const { step, leftovers } = parseStepLine(piece, opts);
          if (step) children.push(step);
          unparsed.push(...leftovers.map((l) => `${text} → ${l}`));
        }
        if (children.length > 0) {
          nodes.push({ type: "repeat", count, children, raw: text });
          i++;
          pendingTitle = undefined;
          continue;
        }
      }

      const { step, leftovers } = parseStepLine(text, opts, pendingTitle);
      if (step) {
        nodes.push(step satisfies StepNode);
        unparsed.push(...leftovers.map((l) => `${text} → ${l}`));
        pendingTitle = undefined;
      } else if (/^notes?\b/i.test(text) && nodes.length > 0) {
        const last = nodes[nodes.length - 1];
        if (last.type === "step") last.notes = text.replace(/^notes?\s*[-:]?\s*/i, "");
      } else if (/^[a-z][a-z /]{0,30}$/i.test(text)) {
        pendingTitle = text; // "Warm up" on its own line
      } else {
        unparsed.push(text);
      }
      i++;
    }
    if (pendingTitle) unparsed.push(pendingTitle);
    return nodes;
  }

  const nodes = parseBlock(0, false);
  return { nodes, unparsed };
}
