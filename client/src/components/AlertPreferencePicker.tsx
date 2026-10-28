import { useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";

export const MAX_TRACKED_POSITIONS = 10;

function selectionSummary(chosen: string[]) {
  if (!chosen.length) return "None selected";
  const shown = chosen.slice(0, 2).join(", ");
  return chosen.length > 2 ? `${shown} +${chosen.length - 2} more` : shown;
}

/** One closed-by-default section so long lists only take space when a member opens them. */
function Group({ title, chosen, children }: { title: string; chosen: string[]; children: React.ReactNode }) {
  return (
    <details className="member-pref-group">
      <summary>
        <span className="member-pref-title">{title}</span>
        <span className="member-pref-summary">{selectionSummary(chosen)}</span>
        {chosen.length > 0 && <span className="member-pref-count" aria-label={`${chosen.length} selected`}>{chosen.length}</span>}
        <ChevronDown size={15} className="member-pref-chevron" aria-hidden="true" />
      </summary>
      <div className="member-pref-body">{children}</div>
    </details>
  );
}

/** Pick from a list of existing values (categories or locations), with a search box for longer lists. */
export function ChoiceGroup({ title, options, chosen, onToggle, emptyText }: { title: string; options: string[]; chosen: string[]; onToggle: (value: string) => void; emptyText: string }) {
  const [filter, setFilter] = useState("");
  // Keep previously saved choices removable even if no published job currently uses them.
  const all = useMemo(() => [...new Set([...chosen, ...options])], [chosen, options]);
  const query = filter.trim().toLocaleLowerCase();
  const visible = query ? all.filter(item => item.toLocaleLowerCase().includes(query)) : all;
  return (
    <Group title={title} chosen={chosen}>
      {all.length > 8 && <input type="search" className="member-pref-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder={`Search ${title.toLocaleLowerCase()}`} aria-label={`Search ${title.toLocaleLowerCase()}`} />}
      <div className="member-chip-list member-pref-scroll">
        {visible.map(item => <button type="button" key={item} className={chosen.includes(item) ? "member-chip selected" : "member-chip"} aria-pressed={chosen.includes(item)} onClick={() => onToggle(item)}>{item}</button>)}
      </div>
      {!all.length && <small>{emptyText}</small>}
      {all.length > 0 && !visible.length && <small>No matches for “{filter.trim()}”.</small>}
    </Group>
  );
}

/** Track any job position or department by typing it (suggestions come from published job titles). */
export function PositionGroup({ title, chosen, onChange, suggestions }: { title: string; chosen: string[]; onChange: (next: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState("");
  const listId = "member-position-suggestions";

  function add() {
    const value = draft.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length < 2 || value.length > 100) { setProblem("Use 2–100 characters."); return; }
    if (chosen.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { setDraft(""); setProblem(""); return; }
    if (chosen.length >= MAX_TRACKED_POSITIONS) { setProblem(`You can track up to ${MAX_TRACKED_POSITIONS} positions.`); return; }
    onChange([...chosen, value]); setDraft(""); setProblem("");
  }

  return (
    <Group title={title} chosen={chosen}>
      <div className="member-pref-add">
        <input
          value={draft}
          list={listId}
          maxLength={100}
          onChange={event => { setDraft(event.target.value); setProblem(""); }}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }}
          placeholder="e.g. Accountant, Nurse, Procurement"
          aria-label="Add a job position or department"
        />
        <button type="button" className="secondary-button" onClick={add}><Plus size={14} />Add</button>
        <datalist id={listId}>{suggestions.map(item => <option key={item} value={item} />)}</datalist>
      </div>
      <small className="member-pref-help">Matches words in a job’s title or category. Add up to {MAX_TRACKED_POSITIONS}.</small>
      {problem && <small role="alert" className="member-pref-problem">{problem}</small>}
      {chosen.length > 0 && (
        <div className="member-chip-list">
          {chosen.map(item => <button type="button" key={item} className="member-chip selected" onClick={() => onChange(chosen.filter(value => value !== item))} aria-label={`Stop tracking ${item}`}>{item} <X size={11} aria-hidden="true" /></button>)}
        </div>
      )}
    </Group>
  );
}
