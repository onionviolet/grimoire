"""Every sentence of the archived originals must appear in a current instruction file,
or sit inside a `drop` row of DISPOSITION.md.
Run from the repo root: python docs/archive/agent-instructions-2026-11-26/coverage_check.py"""
import re, sys, glob

D = "docs/archive/agent-instructions-2026-11-26"


def norm(s):
    s = s.replace(" " + chr(0x2014) + " ", ": ").replace("**", "").replace("`", "")
    return re.sub(r"\s+", " ", s).strip()


new_files = (["AGENTS.md", "CLAUDE.md"] + sorted(glob.glob("docs/agents/*.md"))
             + sorted(glob.glob(".claude/rules/*.md")))
corpus = norm(" ".join(open(f, encoding="utf-8").read() for f in new_files))

drops = {"AGENTS.md": [], "CLAUDE.md": []}
for row in open(f"{D}/DISPOSITION.md", encoding="utf-8"):
    c = [x.strip() for x in row.strip().strip("|").split("|")]
    if len(c) == 5 and c[3] == "drop":
        for part in c[1].split(","):
            a, _, b = part.strip().partition("-")
            drops[c[0]].append((int(a), int(b or a)))


def units(path):
    lines = open(path, encoding="utf-8").read().split("\n")
    state = {"cur": [], "line": 0}
    out = []

    def flush():
        if state["cur"]:
            text = norm(" ".join(state["cur"]))
            for s in re.split(r"(?<=[.!?])\s+(?=[A-Z`*(\"])", text):
                if s:
                    out.append((state["line"], s))
        state["cur"] = []

    in_code = False
    for i, l in enumerate(lines, 1):
        t = l.strip()
        if t.startswith("```"):
            flush()
            in_code = not in_code
            continue
        if in_code:
            if t:
                out.append((i, norm(t)))
            continue
        if not t or t.startswith("#") or re.fullmatch(r"\|[-| ]+\|", t) or t.startswith("<!--"):
            flush()
            continue
        if t.startswith("|"):
            flush()
            for cell in t.strip("|").split("|"):
                if cell.strip():
                    out.append((i, norm(cell)))
            continue
        if re.match(r"[-*] ", t):
            flush()
            state["line"] = i
            state["cur"] = [t[2:]]
        else:
            if not state["cur"]:
                state["line"] = i
            state["cur"].append(t)
    flush()
    return out


bad = 0
tot = {"matched": 0, "dropped": 0}
for name in ("AGENTS", "CLAUDE"):
    for ln, u in units(f"{D}/{name}.original.md"):
        if u in corpus:
            tot["matched"] += 1
        elif any(a <= ln <= b for a, b in drops[name + ".md"]):
            tot["dropped"] += 1
        else:
            bad += 1
            print(f"UNCOVERED {name}.original.md:{ln}: {u[:110]}")
print(tot, "uncovered:", bad)
sys.exit(1 if bad else 0)
