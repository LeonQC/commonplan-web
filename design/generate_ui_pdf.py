from pathlib import Path

from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


W, H = 1280, 720
OUT = Path(__file__).parents[1] / "output/pdf/KEY-3-zhitong-ui-design.pdf"

INK = "#17151F"
MUTED = "#777382"
FAINT = "#A7A3AF"
LINE = "#E8E5EC"
SURFACE = "#FFFFFF"
CANVAS = "#F7F6F8"
SIDEBAR = "#201C2B"
SIDEBAR_2 = "#2A2538"
VIOLET = "#6E56CF"
VIOLET_SOFT = "#EEEAFB"
BLUE = "#4C75DE"
GREEN = "#3E9B76"
YELLOW = "#D89B3C"
RED = "#D95B66"
GITHUB = "#24292F"


def color(hex_value):
    value = hex_value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))


def fill(c, hex_value):
    c.setFillColorRGB(*color(hex_value))


def stroke(c, hex_value):
    c.setStrokeColorRGB(*color(hex_value))


def rr(c, x, y, w, h, r=8, fill_color=SURFACE, stroke_color=None, width=1):
    fill(c, fill_color)
    if stroke_color:
        stroke(c, stroke_color)
        c.setLineWidth(width)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)


def text(c, x, y, value, size=12, color_value=INK, font="Helvetica", max_width=None):
    fill(c, color_value)
    c.setFont(font, size)
    if max_width and stringWidth(value, font, size) > max_width:
        while value and stringWidth(value + "...", font, size) > max_width:
            value = value[:-1]
        value += "..."
    c.drawString(x, y, value)


def centered(c, x, y, value, size=12, color_value=INK, font="Helvetica"):
    fill(c, color_value)
    c.setFont(font, size)
    c.drawCentredString(x, y, value)


def line(c, x1, y1, x2, y2, color_value=LINE, width=1):
    stroke(c, color_value)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def dot(c, x, y, radius, color_value):
    fill(c, color_value)
    c.circle(x, y, radius, fill=1, stroke=0)


def pill(c, x, y, value, bg=VIOLET_SOFT, fg=VIOLET, w=None):
    w = w or max(48, stringWidth(value, "Helvetica-Bold", 9) + 18)
    rr(c, x, y, w, 22, 11, bg)
    centered(c, x + w / 2, y + 7, value, 9, fg, "Helvetica-Bold")
    return w


def button(c, x, y, value, primary=False, w=None):
    w = w or max(76, stringWidth(value, "Helvetica-Bold", 10) + 28)
    rr(c, x, y, w, 32, 7, VIOLET if primary else SURFACE, None if primary else LINE)
    centered(c, x + w / 2, y + 11, value, 10, SURFACE if primary else INK, "Helvetica-Bold")


def avatar(c, x, y, initials="KW", bg=VIOLET):
    fill(c, bg)
    c.circle(x, y, 15, fill=1, stroke=0)
    centered(c, x, y - 3, initials, 8, SURFACE, "Helvetica-Bold")


def page_label(c, number, title):
    text(c, 36, 24, f"KEY-3 / {number:02d}", 9, FAINT, "Helvetica-Bold")
    text(c, 1135, 24, title.upper(), 9, FAINT, "Helvetica-Bold")


def app_shell(c, active="My issues"):
    fill(c, CANVAS)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    fill(c, SIDEBAR)
    c.rect(0, 0, 232, H, fill=1, stroke=0)
    rr(c, 16, 664, 200, 40, 8, SIDEBAR_2)
    rr(c, 29, 674, 20, 20, 6, VIOLET)
    centered(c, 39, 680, "Z", 9, SURFACE, "Helvetica-Bold")
    text(c, 58, 680, "Zhitong", 13, SURFACE, "Helvetica-Bold")
    text(c, 58, 668, "Product workspace", 8, "#A9A2B8")
    nav = [
        ("Inbox", 620),
        ("My issues", 586),
        ("Summary", 552),
        ("Projects", 486),
        ("Views", 452),
        ("Teams", 418),
    ]
    for label, y in nav:
        if label == active:
            rr(c, 14, y - 9, 204, 30, 6, "#393248")
        dot(c, 30, y + 5, 4, VIOLET if label == active else "#777084")
        text(c, 44, y, label, 10, SURFACE if label == active else "#C2BDCC", "Helvetica-Bold" if label == active else "Helvetica")
    text(c, 24, 516, "WORKSPACE", 8, "#81798F", "Helvetica-Bold")
    text(c, 24, 384, "YOUR TEAMS", 8, "#81798F", "Helvetica-Bold")
    teams = [
        ("Team 1", 354, BLUE, [("Overview", 334), ("Issues", 316), ("Cycles", 298), ("Projects", 280), ("Views", 262)]),
        ("Team 2", 234, GREEN, [("Overview", 214), ("Issues", 196), ("Cycles", 178), ("Projects", 160), ("Views", 142)]),
    ]
    for team, y, col, children in teams:
        team_active = active == team or active.startswith(f"{team} /")
        dot(c, 30, y, 7, col)
        text(c, 44, y - 4, team, 10, SURFACE if team_active else "#C2BDCC", "Helvetica-Bold")
        text(c, 202, y - 4, "v", 8, "#81798F", "Helvetica-Bold")
        for child, child_y in children:
            child_active = active == f"{team} / {child}"
            if child_active:
                rr(c, 34, child_y - 8, 184, 20, 6, "#393248")
            dot(c, 50, child_y + 1, 2, col if child_active else "#777084")
            text(c, 60, child_y - 4, child, 9, SURFACE if child_active else "#AFA9BA", "Helvetica-Bold" if child_active else "Helvetica")
    avatar(c, 31, 72)
    text(c, 54, 76, "Keya Wang", 10, SURFACE, "Helvetica-Bold")
    text(c, 54, 62, "keya@zhitong.app", 8, "#918A9F")


def topbar(c, title, subtitle="", action="New issue"):
    fill(c, SURFACE)
    c.rect(232, 650, W - 232, 70, fill=1, stroke=0)
    line(c, 232, 650, W, 650)
    text(c, 262, 687, title, 18, INK, "Helvetica-Bold")
    if subtitle:
        text(c, 262, 668, subtitle, 9, MUTED)
    rr(c, 883, 671, 224, 30, 7, CANVAS, LINE)
    text(c, 900, 682, "Search or jump to...", 9, FAINT)
    pill(c, 1080, 675, "/", "#ECE9EF", MUTED, 20)
    button(c, 1130, 670, action, True, 118)


def task_row(c, y, key, title_value, status_value, priority, assignee, due=""):
    line(c, 262, y - 10, 1246, y - 10)
    dot(c, 277, y + 11, 6, {"Done": GREEN, "In progress": YELLOW, "Todo": FAINT}.get(status_value, BLUE))
    text(c, 294, y + 6, key, 9, MUTED, "Helvetica-Bold")
    text(c, 368, y + 6, title_value, 11, INK, "Helvetica", 430)
    pill(c, 817, y, status_value, "#F1EFF4", MUTED, 82)
    text(c, 930, y + 6, priority, 9, RED if priority == "Urgent" else MUTED)
    avatar(c, 1057, y + 11, assignee, BLUE if assignee != "KW" else VIOLET)
    text(c, 1107, y + 6, due or "No due date", 9, MUTED)


def page_cover(c):
    fill(c, SIDEBAR)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    rr(c, 72, 60, 1136, 600, 24, "#262132")
    for x, y, r, col in [(1060, 570, 140, VIOLET), (1120, 156, 90, BLUE), (175, 140, 70, "#3C3258")]:
        fill(c, col)
        c.circle(x, y, r, fill=1, stroke=0)
    pill(c, 112, 590, "KEY-3", VIOLET, SURFACE, 76)
    text(c, 112, 476, "Zhitong", 54, SURFACE, "Helvetica-Bold")
    text(c, 112, 418, "Task management UI direction", 32, "#D6D0DF", "Helvetica-Bold")
    text(c, 112, 368, "Linear-inspired focus. Jira-inspired summary. Tailwind-aligned system.", 15, "#AAA3B8")
    line(c, 112, 326, 670, 326, "#484057")
    text(c, 112, 278, "16 KEY VIEWS", 9, "#8E879A", "Helvetica-Bold")
    text(c, 112, 250, "Issues / Summary / Projects / Teams / GitHub integration / Detailed settings", 12, "#D4CFDB")
    text(c, 112, 126, "DESIGN SPEC 01", 9, "#8E879A", "Helvetica-Bold")
    text(c, 112, 102, "Desktop 1280 x 720  |  Inter-style typography  |  Light workspace", 11, "#D4CFDB")
    page_label(c, 1, "Cover")
    c.showPage()


def page_my_issues(c):
    app_shell(c, "My issues")
    topbar(c, "My issues", "Everything assigned to you")
    pill(c, 262, 610, "All issues", VIOLET_SOFT, VIOLET, 78)
    pill(c, 350, 610, "Active", "#F1EFF4", MUTED, 58)
    pill(c, 418, 610, "Backlog", "#F1EFF4", MUTED, 66)
    button(c, 1124, 604, "Filter", False, 72)
    text(c, 264, 570, "IN PROGRESS", 9, MUTED, "Helvetica-Bold")
    text(c, 1179, 570, "3", 9, MUTED, "Helvetica-Bold")
    rows = [
        ("KEY-31", "Add JWT access and refresh token auth", "In progress", "Urgent", "KW", "Today"),
        ("KEY-28", "Create issue detail activity timeline", "In progress", "High", "JL", "Aug 2"),
        ("KEY-24", "Improve keyboard navigation", "In progress", "Medium", "MK", "Aug 4"),
    ]
    y = 526
    for row in rows:
        task_row(c, y, *row)
        y -= 52
    text(c, 264, 350, "TODO", 9, MUTED, "Helvetica-Bold")
    text(c, 1179, 350, "4", 9, MUTED, "Helvetica-Bold")
    rows2 = [
        ("KEY-22", "Summary page status distribution", "Todo", "High", "KW", "Aug 5"),
        ("KEY-18", "Create project notification settings", "Todo", "Medium", "JL", "Aug 8"),
        ("KEY-15", "Empty states and onboarding copy", "Todo", "Low", "MK", ""),
        ("KEY-11", "Archive completed projects", "Todo", "Low", "KW", ""),
    ]
    y = 306
    for row in rows2:
        task_row(c, y, *row)
        y -= 52
    page_label(c, 2, "My Issues")
    c.showPage()


def metric_card(c, x, y, label, value, note, accent):
    rr(c, x, y, 210, 104, 10, SURFACE, LINE)
    dot(c, x + 22, y + 80, 5, accent)
    text(c, x + 36, y + 76, label, 9, MUTED, "Helvetica-Bold")
    text(c, x + 18, y + 42, value, 26, INK, "Helvetica-Bold")
    text(c, x + 18, y + 18, note, 9, GREEN if note.startswith("+") else MUTED)


def page_summary(c):
    app_shell(c, "Summary")
    topbar(c, "Summary", "Product workspace / This cycle", "Export")
    metric_card(c, 262, 516, "OPEN ISSUES", "42", "+8 this cycle", VIOLET)
    metric_card(c, 486, 516, "IN PROGRESS", "12", "29% of workload", YELLOW)
    metric_card(c, 710, 516, "COMPLETED", "68", "+14 this cycle", GREEN)
    metric_card(c, 934, 516, "OVERDUE", "5", "Needs attention", RED)
    rr(c, 262, 282, 522, 216, 10, SURFACE, LINE)
    text(c, 282, 466, "Status overview", 13, INK, "Helvetica-Bold")
    text(c, 282, 448, "Issue count by workflow state", 9, MUTED)
    bars = [("Backlog", 118, FAINT), ("Todo", 204, BLUE), ("In progress", 152, YELLOW), ("Done", 258, GREEN)]
    by = 406
    for label, bw, col in bars:
        text(c, 282, by + 4, label, 9, MUTED)
        rr(c, 366, by, 350, 14, 7, "#EFEDF1")
        rr(c, 366, by, bw, 14, 7, col)
        text(c, 728, by + 3, str(round(bw / 10)), 9, MUTED, "Helvetica-Bold")
        by -= 38
    rr(c, 798, 282, 450, 216, 10, SURFACE, LINE)
    text(c, 818, 466, "Priority mix", 13, INK, "Helvetica-Bold")
    text(c, 818, 448, "Current open work", 9, MUTED)
    fill(c, "#F1EFF4")
    c.circle(910, 368, 68, fill=1, stroke=0)
    c.setLineWidth(20)
    for start, extent, col in [(0, 84, RED), (88, 92, YELLOW), (184, 102, BLUE), (290, 66, VIOLET)]:
        stroke(c, col)
        c.arc(842, 300, 978, 436, start, extent)
    labels = [("Urgent", RED, "7"), ("High", YELLOW, "12"), ("Medium", BLUE, "16"), ("Low", VIOLET, "7")]
    ly = 408
    for label, col, value in labels:
        dot(c, 1020, ly + 4, 4, col)
        text(c, 1032, ly, label, 9, MUTED)
        text(c, 1196, ly, value, 9, INK, "Helvetica-Bold")
        ly -= 34
    rr(c, 262, 70, 986, 194, 10, SURFACE, LINE)
    text(c, 282, 232, "Recent activity", 13, INK, "Helvetica-Bold")
    activity = [
        ("KW", "moved KEY-31 to In progress", "8 min ago", VIOLET),
        ("JL", "commented on KEY-28", "34 min ago", BLUE),
        ("MK", "completed KEY-09", "2 hours ago", GREEN),
    ]
    ay = 188
    for initials, action, when, col in activity:
        avatar(c, 300, ay + 5, initials, col)
        text(c, 326, ay + 4, action, 10, INK)
        text(c, 1110, ay + 4, when, 9, MUTED)
        line(c, 282, ay - 17, 1228, ay - 17)
        ay -= 48
    page_label(c, 3, "Summary")
    c.showPage()


def page_detail(c):
    app_shell(c, "My issues")
    topbar(c, "KEY-31", "Product workspace / Authentication", "Share")
    text(c, 270, 607, "Add JWT access and refresh token authorization", 24, INK, "Helvetica-Bold")
    pill(c, 270, 567, "In progress", "#FFF2D9", "#9A681C", 92)
    pill(c, 372, 567, "Backend", VIOLET_SOFT, VIOLET, 70)
    rr(c, 270, 342, 618, 202, 10, SURFACE, LINE)
    text(c, 290, 510, "Description", 12, INK, "Helvetica-Bold")
    text(c, 290, 480, "Keep Google OAuth on the confidential backend client.", 11, INK)
    text(c, 290, 458, "Issue short-lived access tokens and rotating refresh tokens.", 11, INK)
    text(c, 290, 426, "Acceptance criteria", 10, MUTED, "Helvetica-Bold")
    checks = [
        "Refresh tokens and client secret never reach browser JavaScript",
        "Authentication remains independent from richer product sessions",
        "Protected routes return 401 without a valid access token",
    ]
    cy = 398
    for item in checks:
        rr(c, 292, cy - 1, 14, 14, 4, GREEN)
        centered(c, 299, cy + 2, "v", 8, SURFACE, "Helvetica-Bold")
        text(c, 316, cy, item, 10, INK)
        cy -= 26
    rr(c, 270, 72, 618, 252, 10, SURFACE, LINE)
    text(c, 290, 290, "Activity", 12, INK, "Helvetica-Bold")
    avatar(c, 304, 246, "KW")
    text(c, 330, 252, "Keya Wang", 10, INK, "Helvetica-Bold")
    text(c, 330, 234, "Started work on this issue", 9, MUTED)
    line(c, 304, 218, 304, 178, LINE, 2)
    avatar(c, 304, 162, "CD", BLUE)
    text(c, 330, 168, "Codex", 10, INK, "Helvetica-Bold")
    text(c, 330, 150, "Added token rotation, revocation, and authentication tests", 9, MUTED)
    rr(c, 910, 342, 338, 202, 10, SURFACE, LINE)
    text(c, 932, 510, "Properties", 12, INK, "Helvetica-Bold")
    props = [("Assignee", "Keya Wang"), ("Priority", "Urgent"), ("Cycle", "Cycle 3"), ("Due date", "Today"), ("Project", "Zhitong")]
    py = 478
    for label, value in props:
        text(c, 932, py, label, 9, MUTED)
        text(c, 1062, py, value, 9, INK, "Helvetica-Bold")
        py -= 31
    rr(c, 910, 72, 338, 252, 10, SURFACE, LINE)
    text(c, 932, 290, "Development", 12, INK, "Helvetica-Bold")
    dot(c, 940, 256, 9, GITHUB)
    text(c, 958, 260, "Pull request #142", 9, INK, "Helvetica-Bold")
    pill(c, 1152, 250, "Merged", "#E8F5EF", GREEN, 72)
    text(c, 958, 240, "[KEY-31] Add JWT authentication", 9, MUTED, max_width=252)
    text(c, 958, 222, "wangd606 / Project-zhitong-1", 8, FAINT)
    pill(c, 958, 194, "Title matched KEY-31", VIOLET_SOFT, VIOLET, 142)
    line(c, 932, 184, 1226, 184)
    text(c, 932, 158, "Sub-issues", 10, INK, "Helvetica-Bold")
    subs = [("KEY-32", "Add auth dependency", GREEN), ("KEY-33", "Session login gate", YELLOW)]
    sy = 126
    for key, label, col in subs:
        dot(c, 938, sy + 4, 5, col)
        text(c, 952, sy, key, 9, MUTED, "Helvetica-Bold")
        text(c, 1014, sy, label, 9, INK)
        sy -= 30
    page_label(c, 4, "Issue Detail")
    c.showPage()


def page_create(c):
    app_shell(c, "My issues")
    topbar(c, "My issues", "Everything assigned to you")
    fill(c, "#17151F")
    c.setFillAlpha(0.34)
    c.rect(232, 0, W - 232, 650, fill=1, stroke=0)
    c.setFillAlpha(1)
    rr(c, 402, 112, 710, 490, 14, SURFACE)
    text(c, 432, 566, "Create issue", 18, INK, "Helvetica-Bold")
    pill(c, 1012, 558, "Esc", "#F1EFF4", MUTED, 48)
    line(c, 402, 540, 1112, 540)
    text(c, 432, 506, "TITLE", 8, MUTED, "Helvetica-Bold")
    rr(c, 432, 452, 650, 42, 7, SURFACE, LINE)
    text(c, 448, 468, "What needs to be done?", 12, FAINT)
    text(c, 432, 420, "DESCRIPTION", 8, MUTED, "Helvetica-Bold")
    rr(c, 432, 314, 650, 92, 7, SURFACE, LINE)
    text(c, 448, 378, "Add context, acceptance criteria, or paste a link...", 10, FAINT)
    text(c, 432, 280, "PROPERTIES", 8, MUTED, "Helvetica-Bold")
    pill(c, 432, 240, "Status: Todo", "#F1EFF4", MUTED, 94)
    pill(c, 536, 240, "Priority: No priority", "#F1EFF4", MUTED, 126)
    pill(c, 672, 240, "Assignee: Me", VIOLET_SOFT, VIOLET, 96)
    pill(c, 778, 240, "Project: Zhitong", "#F1EFF4", MUTED, 110)
    line(c, 402, 202, 1112, 202)
    text(c, 432, 166, "Press", 9, MUTED)
    pill(c, 462, 158, "Cmd + Enter", "#F1EFF4", MUTED, 82)
    text(c, 554, 166, "to create", 9, MUTED)
    button(c, 930, 148, "Cancel", False, 70)
    button(c, 1010, 148, "Create issue", True, 102)
    page_label(c, 5, "Create Issue")
    c.showPage()


def swatch(c, x, y, hex_value, label):
    rr(c, x, y, 94, 72, 8, hex_value)
    text(c, x, y - 16, label, 8, MUTED, "Helvetica-Bold")
    text(c, x, y - 30, hex_value, 8, FAINT)


def page_system(c):
    fill(c, CANVAS)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    text(c, 54, 660, "Zhitong UI system", 26, INK, "Helvetica-Bold")
    text(c, 54, 636, "Tailwind-aligned scales, tuned for Linear-like density.", 11, MUTED)
    text(c, 54, 590, "COLOR", 9, MUTED, "Helvetica-Bold")
    palette = [(SIDEBAR, "Slate 950"), (INK, "Slate 900"), (MUTED, "Slate 500"), (LINE, "Slate 200"), (SURFACE, "White"), (VIOLET, "Violet 600"), (BLUE, "Blue 500"), (GREEN, "Emerald 500")]
    x = 54
    for col, label in palette:
        swatch(c, x, 500, col, label)
        x += 116
    text(c, 54, 430, "COMPONENTS", 9, MUTED, "Helvetica-Bold")
    rr(c, 54, 254, 540, 148, 10, SURFACE, LINE)
    text(c, 76, 372, "Actions and controls", 12, INK, "Helvetica-Bold")
    button(c, 76, 322, "Create issue", True, 104)
    button(c, 192, 322, "Secondary", False, 90)
    pill(c, 294, 327, "In progress", "#FFF2D9", "#9A681C", 90)
    pill(c, 394, 327, "Backend", VIOLET_SOFT, VIOLET, 70)
    rr(c, 76, 274, 300, 34, 7, SURFACE, LINE)
    text(c, 90, 286, "Search issues...", 9, FAINT)
    rr(c, 616, 254, 610, 148, 10, SURFACE, LINE)
    text(c, 638, 372, "Issue row anatomy", 12, INK, "Helvetica-Bold")
    dot(c, 646, 330, 6, YELLOW)
    text(c, 662, 326, "KEY-31", 9, MUTED, "Helvetica-Bold")
    text(c, 724, 326, "Add JWT access and refresh token auth", 10, INK)
    pill(c, 1010, 317, "In progress", "#F1EFF4", MUTED, 82)
    avatar(c, 1158, 328, "KW")
    line(c, 638, 302, 1204, 302)
    text(c, 638, 278, "32 px row / 12 px label / 8 px radius / 1 px border", 9, MUTED)
    text(c, 54, 204, "SPACING + TYPE", 9, MUTED, "Helvetica-Bold")
    rr(c, 54, 58, 1172, 120, 10, SURFACE, LINE)
    for i, (label, width) in enumerate([("1 / 4", 12), ("2 / 8", 24), ("3 / 12", 36), ("4 / 16", 48), ("6 / 24", 72), ("8 / 32", 96)]):
        x = 82 + i * 120
        rr(c, x, 110, width, 12, 6, VIOLET)
        text(c, x, 88, label, 8, MUTED, "Helvetica-Bold")
    text(c, 824, 132, "Page title / 24 / Semibold", 16, INK, "Helvetica-Bold")
    text(c, 824, 102, "Body / 14 / Regular - compact and readable", 10, INK)
    text(c, 824, 78, "LABEL / 11 / MEDIUM", 8, MUTED, "Helvetica-Bold")
    page_label(c, 16, "Design System")
    c.showPage()


def property_row(c, x, y, label, value, accent=None):
    text(c, x, y, label, 9, MUTED)
    if accent:
        dot(c, x + 132, y + 4, 5, accent)
        text(c, x + 146, y, value, 9, INK, "Helvetica-Bold")
    else:
        text(c, x + 132, y, value, 9, INK, "Helvetica-Bold")


def page_project_detail(c):
    app_shell(c, "Projects")
    topbar(c, "Projects / Zhitong", "Product workspace / Active project", "New issue")
    pill(c, 262, 606, "In progress", "#FFF2D9", "#9A681C", 92)
    text(c, 262, 568, "Zhitong product workspace", 25, INK, "Helvetica-Bold")
    text(c, 262, 544, "A focused task system for teams that want speed without losing context.", 11, MUTED)

    rr(c, 262, 438, 986, 86, 10, SURFACE, LINE)
    text(c, 282, 498, "Project description", 12, INK, "Helvetica-Bold")
    text(c, 282, 476, "Build a fast, team-scoped issue workspace with clear ownership, dependable authentication,", 9, MUTED)
    text(c, 282, 458, "and enough project context for product, engineering, and design to plan the same release.", 9, MUTED)
    pill(c, 1082, 466, "Product brief", VIOLET_SOFT, VIOLET, 126)

    rr(c, 262, 292, 470, 126, 10, SURFACE, LINE)
    text(c, 282, 390, "Objectives & success criteria", 12, INK, "Helvetica-Bold")
    dot(c, 286, 360, 4, VIOLET)
    text(c, 300, 356, "Ship the complete issue workflow for Team 1", 9, INK)
    dot(c, 286, 334, 4, BLUE)
    text(c, 300, 330, "Keep protected API requests below 300 ms p95", 9, INK)
    dot(c, 286, 308, 4, GREEN)
    text(c, 300, 304, "Reach 90% milestone completion before launch", 9, INK)

    rr(c, 752, 292, 496, 126, 10, SURFACE, LINE)
    text(c, 772, 390, "Latest project update", 12, INK, "Helvetica-Bold")
    text(c, 772, 366, "Aug 2 - Authentication foundations are complete.", 9, INK, "Helvetica-Bold")
    text(c, 772, 346, "JWT access and refresh flows passed backend validation.", 9, MUTED)
    text(c, 772, 326, "Next: finish the issue activity timeline and summary filters.", 9, MUTED)
    text(c, 772, 304, "Posted by Keya Wang", 8, FAINT)

    rr(c, 262, 72, 610, 200, 10, SURFACE, LINE)
    text(c, 282, 244, "Milestones", 13, INK, "Helvetica-Bold")
    milestones = [
        ("Foundation", "Complete", "12 / 12", GREEN),
        ("Authentication", "In progress", "7 / 10", YELLOW),
        ("Core issue workflow", "In progress", "10 / 16", VIOLET),
        ("Launch readiness", "Planned", "5 / 12", FAINT),
    ]
    y = 214
    for label, status_value, count, col in milestones:
        dot(c, 286, y + 5, 6, col)
        text(c, 302, y, label, 10, INK, "Helvetica-Bold")
        pill(c, 594, y - 8, status_value, "#F1EFF4", MUTED, 86)
        text(c, 818, y, count, 9, MUTED, "Helvetica-Bold")
        line(c, 282, y - 16, 852, y - 16)
        y -= 40
    rr(c, 892, 72, 356, 200, 10, SURFACE, LINE)
    text(c, 914, 244, "Project details", 13, INK, "Helvetica-Bold")
    property_row(c, 914, 214, "Status", "In progress", YELLOW)
    property_row(c, 914, 188, "Team domain", "Team 1", BLUE)
    property_row(c, 914, 162, "Lead", "Keya Wang")
    property_row(c, 914, 136, "Cycle", "Cycle 3")
    property_row(c, 914, 110, "Target date", "Aug 28, 2026")
    page_label(c, 6, "Project Detail")
    c.showPage()


def page_view_detail(c):
    app_shell(c, "Views")
    topbar(c, "Views / Launch blockers", "Saved view / Scoped to Team 1", "New issue")
    pill(c, 262, 607, "Saved view", VIOLET_SOFT, VIOLET, 82)
    button(c, 1086, 604, "Edit filters", False, 98)
    button(c, 1194, 604, "...", False, 42)
    rr(c, 262, 554, 986, 38, 8, SURFACE, LINE)
    text(c, 278, 568, "Status is active", 9, INK, "Helvetica-Bold")
    text(c, 382, 568, "AND", 8, FAINT, "Helvetica-Bold")
    text(c, 420, 568, "Priority is urgent or high", 9, INK, "Helvetica-Bold")
    text(c, 580, 568, "AND", 8, FAINT, "Helvetica-Bold")
    text(c, 618, 568, "Project is Zhitong", 9, INK, "Helvetica-Bold")
    text(c, 264, 518, "GROUPED BY STATUS", 9, MUTED, "Helvetica-Bold")
    groups = [
        ("IN PROGRESS", 462, YELLOW, [
            ("KEY-31", "Add JWT access and refresh tokens", "Urgent", "KW"),
            ("KEY-28", "Complete issue activity timeline", "High", "JL"),
        ]),
        ("TODO", 310, BLUE, [
            ("KEY-22", "Summary page status distribution", "High", "KW"),
            ("KEY-18", "Project notification settings", "High", "JL"),
        ]),
        ("BACKLOG", 158, FAINT, [
            ("KEY-40", "Add team-scoped custom views", "High", "MK"),
        ]),
    ]
    for group, y, col, rows in groups:
        dot(c, 270, y + 5, 5, col)
        text(c, 284, y, group, 9, MUTED, "Helvetica-Bold")
        text(c, 1218, y, str(len(rows)), 9, MUTED, "Helvetica-Bold")
        row_y = y - 42
        for key, title_value, priority, assignee in rows:
            rr(c, 276, row_y - 10, 960, 40, 7, SURFACE, LINE)
            text(c, 294, row_y + 5, key, 9, MUTED, "Helvetica-Bold")
            text(c, 368, row_y + 5, title_value, 10, INK)
            text(c, 1000, row_y + 5, priority, 9, RED if priority == "Urgent" else YELLOW, "Helvetica-Bold")
            avatar(c, 1188, row_y + 9, assignee, VIOLET if assignee == "KW" else BLUE)
            row_y -= 48
    page_label(c, 7, "View Detail")
    c.showPage()


def page_team_detail(c):
    app_shell(c, "Team 1 / Overview")
    topbar(c, "Team 1", "Team domain / 3 projects / 24 open issues", "New issue")
    rr(c, 262, 542, 986, 78, 10, "#F4F1FD", LINE)
    dot(c, 292, 581, 12, BLUE)
    text(c, 316, 586, "Team 1 domain", 14, INK, "Helvetica-Bold")
    text(c, 316, 566, "The active team scopes every project, view, and issue below.", 9, MUTED)
    text(c, 950, 576, "Switch teams from YOUR TEAMS", 9, VIOLET, "Helvetica-Bold")
    rr(c, 262, 90, 630, 428, 10, SURFACE, LINE)
    text(c, 282, 486, "Team 1 projects", 13, INK, "Helvetica-Bold")
    projects = [
        ("Zhitong product workspace", "34 / 50 issues", "68%", VIOLET),
        ("Authentication foundations", "18 / 22 issues", "82%", GREEN),
        ("Mobile experience", "9 / 24 issues", "38%", BLUE),
    ]
    y = 434
    for name, count, progress, col in projects:
        dot(c, 286, y + 8, 6, col)
        text(c, 304, y + 4, name, 10, INK, "Helvetica-Bold")
        text(c, 304, y - 14, count, 8, MUTED)
        pill(c, 798, y - 8, progress, "#F1EFF4", col, 60)
        line(c, 282, y - 32, 872, y - 32)
        y -= 82
    button(c, 282, 112, "View all Team 1 projects", False, 190)

    rr(c, 912, 90, 336, 428, 10, SURFACE, LINE)
    text(c, 934, 486, "Team 1 recent issues", 13, INK, "Helvetica-Bold")
    issues = [
        ("KEY-31", "JWT access and refresh", YELLOW),
        ("KEY-28", "Issue activity timeline", BLUE),
        ("KEY-22", "Summary status view", FAINT),
        ("KEY-18", "Project notifications", RED),
    ]
    y = 440
    for key, title_value, col in issues:
        dot(c, 938, y + 5, 5, col)
        text(c, 952, y + 1, key, 9, MUTED, "Helvetica-Bold")
        text(c, 1008, y + 1, title_value, 9, INK, max_width=202)
        line(c, 934, y - 22, 1226, y - 22)
        y -= 58
    button(c, 934, 112, "View Team 1 issues", True, 168)
    page_label(c, 8, "Team Domain")
    c.showPage()


def settings_shell(c, context, active):
    fill(c, CANVAS)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    fill(c, SURFACE)
    c.rect(0, 0, 310, H, fill=1, stroke=0)
    line(c, 310, 0, 310, H)
    text(c, 28, 680, "Settings", 18, INK, "Helvetica-Bold")
    text(c, 28, 648, "<  Back to app", 9, MUTED, "Helvetica-Bold")
    text(c, 28, 606, "SETTINGS SCOPE", 8, FAINT, "Helvetica-Bold")
    contexts = [
        ("user", "Personal", "Keya Wang", VIOLET),
        ("space", "Workspace / Zhitong", "Administration", BLUE),
    ]
    y = 560
    for key, name, note, col in contexts:
        if key == context:
            rr(c, 18, y - 12, 274, 48, 8, VIOLET_SOFT)
        dot(c, 40, y + 12, 11, col)
        text(c, 60, y + 16, name, 10, INK, "Helvetica-Bold")
        text(c, 60, y, note, 8, MUTED)
        y -= 58
    rr(c, 20, 424, 270, 28, 6, CANVAS, LINE)
    text(c, 36, 434, "Search settings", 8, FAINT)
    if context == "user":
        sections = [
            ("PERSONAL", None),
            ("Preferences", "Preferences"),
            ("Profile", "Profile"),
            ("Notifications", "Notifications"),
            ("Code & reviews", "Code & reviews"),
            ("Security & access", "Security & access"),
            ("Connected accounts", "Connected accounts"),
            ("Agent personalization", "Agent personalization"),
        ]
    else:
        sections = [
            ("ADMINISTRATION", None),
            ("Workspace", "Workspace"),
            ("Teams", "Teams"),
            ("Members", "Members"),
            ("Security", "Security"),
            ("API", "API"),
            ("Applications", "Applications"),
            ("Billing", "Billing"),
            ("Import & export", "Import & export"),
            ("YOUR TEAMS", None),
            ("Team 1", "Team 1"),
            ("Team 2", "Team 2"),
            ("+ Create a team", "+ Create a team"),
        ]
    y = 388
    for label, key in sections:
        if key is None:
            text(c, 28, y, label, 7, FAINT, "Helvetica-Bold")
            y -= 22
            continue
        if key == active:
            rr(c, 18, y - 8, 274, 26, 6, VIOLET_SOFT)
        text(c, 36, y, label, 9, VIOLET if key == active else MUTED, "Helvetica-Bold" if key == active else "Helvetica")
        y -= 26


def toggle(c, x, y, on=True):
    rr(c, x, y, 36, 20, 10, VIOLET if on else "#D9D6DE")
    dot(c, x + (26 if on else 10), y + 10, 7, SURFACE)


def page_settings_admin(c):
    settings_shell(c, "space", "Workspace")
    text(c, 350, 672, "Workspace settings", 22, INK, "Helvetica-Bold")
    text(c, 350, 648, "Workspace / Zhitong", 10, MUTED)
    rr(c, 350, 466, 880, 148, 10, SURFACE, LINE)
    text(c, 372, 582, "Workspace profile", 13, INK, "Helvetica-Bold")
    text(c, 372, 546, "Workspace name", 9, MUTED)
    rr(c, 372, 500, 510, 34, 7, SURFACE, LINE)
    text(c, 386, 512, "Zhitong", 10, INK)
    button(c, 1100, 498, "Save", True, 90)
    rr(c, 350, 252, 880, 194, 10, SURFACE, LINE)
    text(c, 372, 414, "Workspace access", 13, INK, "Helvetica-Bold")
    text(c, 372, 382, "Allow members to invite collaborators", 10, INK, "Helvetica-Bold")
    text(c, 372, 364, "Workspace admins can review and revoke invitations.", 9, MUTED)
    toggle(c, 1152, 370, True)
    line(c, 372, 342, 1202, 342)
    text(c, 372, 310, "Require verified email domains", 10, INK, "Helvetica-Bold")
    text(c, 372, 292, "Restrict new accounts to approved company domains.", 9, MUTED)
    toggle(c, 1152, 298, False)
    rr(c, 350, 72, 880, 160, 10, "#FFF8F8", "#F2CDD1")
    text(c, 372, 200, "Danger zone", 13, RED, "Helvetica-Bold")
    text(c, 372, 164, "Delete workspace", 10, INK, "Helvetica-Bold")
    text(c, 372, 146, "Permanently remove every project, issue, and membership in Zhitong.", 9, MUTED)
    button(c, 1082, 142, "Delete", False, 106)
    page_label(c, 11, "Workspace Settings")
    c.showPage()


def page_settings_teams(c):
    settings_shell(c, "user", "Profile")
    text(c, 350, 672, "Personal settings", 22, INK, "Helvetica-Bold")
    text(c, 350, 648, "Personal  /  Profile", 10, MUTED)
    rr(c, 350, 452, 880, 162, 10, SURFACE, LINE)
    avatar(c, 394, 560, "KW")
    text(c, 430, 570, "Keya Wang", 14, INK, "Helvetica-Bold")
    text(c, 430, 550, "keya@zhitong.app", 9, MUTED)
    text(c, 372, 506, "Display name", 9, MUTED)
    rr(c, 372, 466, 510, 32, 7, SURFACE, LINE)
    text(c, 386, 478, "Keya Wang", 10, INK)
    button(c, 1100, 464, "Save", True, 90)

    rr(c, 350, 254, 880, 174, 10, SURFACE, LINE)
    text(c, 372, 396, "Connected identities", 13, INK, "Helvetica-Bold")
    text(c, 372, 356, "Email and password", 10, INK, "Helvetica-Bold")
    pill(c, 1088, 346, "Enabled", "#E8F5EF", GREEN, 84)
    text(c, 372, 320, "Google", 10, INK, "Helvetica-Bold")
    text(c, 430, 320, "keya@gmail.com", 9, MUTED)
    pill(c, 1088, 310, "Connected", VIOLET_SOFT, VIOLET, 94)
    line(c, 372, 340, 1202, 340)

    rr(c, 350, 72, 880, 158, 10, SURFACE, LINE)
    text(c, 372, 198, "Personal defaults", 13, INK, "Helvetica-Bold")
    property_row(c, 372, 158, "Timezone", "America/New_York")
    property_row(c, 372, 122, "Default team domain", "Team 1", BLUE)
    button(c, 1082, 110, "Edit preferences", False, 126)
    page_label(c, 9, "Personal Profile")
    c.showPage()


def page_user_security(c):
    settings_shell(c, "user", "Security & access")
    text(c, 350, 672, "Security & connected accounts", 22, INK, "Helvetica-Bold")
    text(c, 350, 648, "Personal  /  Security & access", 10, MUTED)
    rr(c, 350, 478, 880, 136, 10, SURFACE, LINE)
    text(c, 372, 582, "Password and sessions", 13, INK, "Helvetica-Bold")
    text(c, 372, 546, "Password", 10, INK, "Helvetica-Bold")
    text(c, 520, 546, "Last changed Jul 28, 2026", 9, MUTED)
    button(c, 1080, 532, "Change password", False, 128)
    text(c, 372, 506, "Active sessions", 10, INK, "Helvetica-Bold")
    text(c, 520, 506, "2 devices", 9, MUTED)
    button(c, 1080, 492, "Manage sessions", False, 128)

    rr(c, 350, 274, 880, 184, 10, SURFACE, LINE)
    text(c, 372, 426, "Access protection", 13, INK, "Helvetica-Bold")
    text(c, 372, 388, "Two-factor authentication", 10, INK, "Helvetica-Bold")
    text(c, 372, 370, "Require a second factor for sensitive account actions.", 9, MUTED)
    toggle(c, 1152, 376, False)
    line(c, 372, 348, 1202, 348)
    text(c, 372, 316, "Sign-in alerts", 10, INK, "Helvetica-Bold")
    text(c, 372, 298, "Email when a new browser signs in.", 9, MUTED)
    toggle(c, 1152, 304, True)

    rr(c, 350, 72, 880, 182, 10, SURFACE, LINE)
    text(c, 372, 222, "Connected accounts", 13, INK, "Helvetica-Bold")
    text(c, 372, 202, "USER LOGIN IDENTITIES - linked to Keya Wang, not installed workspace apps", 8, VIOLET, "Helvetica-Bold")
    text(c, 372, 172, "Google", 10, INK, "Helvetica-Bold")
    text(c, 450, 172, "keya@gmail.com", 9, MUTED)
    pill(c, 1020, 162, "Connected", VIOLET_SOFT, VIOLET, 92)
    button(c, 1122, 158, "Disconnect", False, 82)
    line(c, 372, 144, 1202, 144)
    text(c, 372, 108, "Email and password", 10, INK, "Helvetica-Bold")
    pill(c, 1112, 98, "Primary", "#E8F5EF", GREEN, 92)
    page_label(c, 10, "Security & Accounts")
    c.showPage()


def page_space_teams_members(c):
    settings_shell(c, "space", "Teams")
    text(c, 350, 672, "Teams & members", 22, INK, "Helvetica-Bold")
    text(c, 350, 648, "Workspace / Zhitong  /  Teams", 10, MUTED)
    rr(c, 350, 426, 880, 188, 10, SURFACE, LINE)
    text(c, 372, 582, "Teams", 13, INK, "Helvetica-Bold")
    text(c, 372, 558, "Teams are domains that scope projects, views, and issues.", 9, MUTED)
    team_rows = [("Team 1", "8 members", "3 projects", BLUE), ("Team 2", "5 members", "2 projects", GREEN)]
    y = 510
    for name, members, projects, col in team_rows:
        dot(c, 382, y + 8, 10, col)
        text(c, 406, y + 4, name, 10, INK, "Helvetica-Bold")
        text(c, 620, y + 4, members, 9, MUTED)
        text(c, 780, y + 4, projects, 9, MUTED)
        button(c, 1102, y - 10, "Manage", False, 92)
        y -= 58
    rr(c, 350, 174, 880, 232, 10, SURFACE, LINE)
    text(c, 372, 374, "Members", 13, INK, "Helvetica-Bold")
    text(c, 372, 350, "Manage workspace access and team membership.", 9, MUTED)
    members = [("Keya Wang", "Admin", "Team 1, Team 2"), ("Jenny Lin", "Member", "Team 1"), ("Mike Kim", "Member", "Team 2")]
    y = 306
    for name, role, teams in members:
        avatar(c, 388, y + 6, "".join(part[0] for part in name.split()), BLUE if name != "Keya Wang" else VIOLET)
        text(c, 416, y + 10, name, 10, INK, "Helvetica-Bold")
        text(c, 416, y - 6, teams, 8, MUTED)
        pill(c, 914, y - 5, role, "#F1EFF4", MUTED, 74)
        button(c, 1102, y - 10, "Edit", False, 92)
        y -= 58
    button(c, 350, 102, "Invite and manage members", True, 196)
    page_label(c, 12, "Teams & Members")
    c.showPage()


def page_space_administration(c):
    settings_shell(c, "space", "Security")
    text(c, 350, 672, "Administration controls", 22, INK, "Helvetica-Bold")
    text(c, 350, 648, "Workspace / Zhitong - applications are integrations, not personal login identities.", 10, MUTED)
    cards = [
        ("Security", "SSO, allowed domains, audit log", "Review policies", VIOLET),
        ("API", "Personal keys and workspace webhooks", "Manage API", BLUE),
        ("Applications", "Workspace-installed OAuth apps and integrations", "Manage apps", GREEN),
        ("Billing", "Plan, seats, invoices and payment method", "Open billing", YELLOW),
        ("Import & export", "Import from Jira / Linear; export workspace", "Transfer data", RED),
    ]
    y = 560
    for title_value, note, action, col in cards:
        rr(c, 350, y - 44, 880, 92, 10, SURFACE, LINE)
        dot(c, 380, y + 4, 10, col)
        text(c, 404, y + 12, title_value, 11, INK, "Helvetica-Bold")
        text(c, 404, y - 8, note, 9, MUTED)
        button(c, 1070, y - 12, action, False, 132)
        y -= 102
    page_label(c, 13, "Administration")
    c.showPage()


def page_github_integration(c):
    settings_shell(c, "space", "Applications")
    text(c, 350, 672, "GitHub integration", 22, INK, "Helvetica-Bold")
    text(c, 350, 648, "Workspace / Zhitong  /  Applications  /  GitHub", 10, MUTED)

    rr(c, 350, 494, 880, 120, 10, SURFACE, LINE)
    dot(c, 392, 555, 22, GITHUB)
    centered(c, 392, 549, "GH", 9, SURFACE, "Helvetica-Bold")
    text(c, 430, 568, "GitHub", 14, INK, "Helvetica-Bold")
    text(c, 430, 546, "Connected to wangd606 via GitHub App", 9, MUTED)
    text(c, 430, 526, "PR webhooks are syncing normally  /  Last event 2 min ago", 9, MUTED)
    pill(c, 1014, 546, "Connected", "#E8F5EF", GREEN, 92)
    button(c, 1118, 538, "Manage", False, 84)

    rr(c, 350, 222, 880, 252, 10, SURFACE, LINE)
    text(c, 372, 442, "Automatic pull request linking", 13, INK, "Helvetica-Bold")
    pill(c, 1042, 432, "Always on", "#E8F5EF", GREEN, 82)
    text(c, 372, 416, "No repository, project, or team mapping is required.", 9, MUTED)
    text(c, 372, 396, "A PR links automatically when its title contains an exact workspace item key.", 9, MUTED)

    text(c, 372, 360, "PR TITLE", 8, FAINT, "Helvetica-Bold")
    rr(c, 372, 294, 836, 52, 8, CANVAS, LINE)
    text(c, 392, 320, "[KEY-31] Keep refresh tokens in the server-side BFF", 10, INK, "Helvetica-Bold")
    text(c, 392, 302, "Detected exact item key: KEY-31", 8, VIOLET, "Helvetica-Bold")

    text(c, 372, 268, "MATCH RULE", 8, FAINT, "Helvetica-Bold")
    pill(c, 372, 234, "PR title only", VIOLET_SOFT, VIOLET, 88)
    text(c, 482, 242, "Pattern", 8, MUTED, "Helvetica-Bold")
    pill(c, 528, 234, "KEY-[number]", "#ECE9EF", INK, 102)
    text(c, 652, 242, "Result", 8, MUTED, "Helvetica-Bold")
    text(c, 692, 242, "Link PR under the item's Development section", 9, INK)

    rr(c, 350, 72, 880, 130, 10, SURFACE, LINE)
    text(c, 372, 170, "Link lifecycle", 13, INK, "Helvetica-Bold")
    text(c, 372, 144, "PR opened or title edited", 9, INK, "Helvetica-Bold")
    text(c, 530, 144, ">", 10, FAINT, "Helvetica-Bold")
    text(c, 554, 144, "Find item by title key", 9, INK, "Helvetica-Bold")
    text(c, 698, 144, ">", 10, FAINT, "Helvetica-Bold")
    text(c, 722, 144, "Attach PR and sync status", 9, INK, "Helvetica-Bold")
    text(c, 372, 110, "Titles without an exact item key stay unlinked. Branch names are not inspected.", 9, MUTED)
    page_label(c, 14, "GitHub Integration")
    c.showPage()


def page_account_menu(c):
    app_shell(c, "My issues")
    topbar(c, "My issues", "Everything assigned to you")
    pill(c, 262, 610, "All issues", VIOLET_SOFT, VIOLET, 78)
    text(c, 264, 570, "IN PROGRESS", 9, MUTED, "Helvetica-Bold")
    background_rows = [
        ("KEY-31", "Add JWT access and refresh token auth", "In progress", "Urgent", "KW", "Today"),
        ("KEY-28", "Create issue detail activity timeline", "In progress", "High", "JL", "Aug 2"),
        ("KEY-24", "Improve keyboard navigation", "In progress", "Medium", "MK", "Aug 4"),
    ]
    y = 526
    for row in background_rows:
        task_row(c, y, *row)
        y -= 52
    fill(c, "#17151F")
    c.setFillAlpha(0.12)
    c.rect(232, 0, W - 232, 650, fill=1, stroke=0)
    c.setFillAlpha(1)
    rr(c, 18, 96, 292, 330, 12, SURFACE, LINE)
    avatar(c, 54, 386, "KW")
    text(c, 82, 392, "Keya Wang", 11, INK, "Helvetica-Bold")
    text(c, 82, 374, "keya@zhitong.app", 9, MUTED)
    line(c, 34, 350, 294, 350)
    rr(c, 30, 306, 268, 34, 7, "#F1EFF4")
    text(c, 46, 318, "Settings", 10, INK, "Helvetica-Bold")
    text(c, 244, 318, "G then S", 8, MUTED, "Helvetica-Bold")
    text(c, 46, 274, "Invite and manage members", 10, INK, "Helvetica-Bold")
    line(c, 34, 250, 294, 250)
    text(c, 46, 218, "Switch workspace", 10, INK, "Helvetica-Bold")
    text(c, 226, 218, "O then W", 8, MUTED, "Helvetica-Bold")
    line(c, 34, 194, 294, 194)
    text(c, 46, 154, "Log out", 10, RED, "Helvetica-Bold")
    text(c, 246, 154, "Alt+Q", 8, MUTED, "Helvetica-Bold")
    page_label(c, 15, "Account Menu")
    c.showPage()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("KEY-3 - Zhitong UI Design")
    c.setAuthor("Codex for Project Zhitong")
    for page in (
        page_cover,
        page_my_issues,
        page_summary,
        page_detail,
        page_create,
        page_project_detail,
        page_view_detail,
        page_team_detail,
        page_settings_teams,
        page_user_security,
        page_settings_admin,
        page_space_teams_members,
        page_space_administration,
        page_github_integration,
        page_account_menu,
        page_system,
    ):
        page(c)
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
