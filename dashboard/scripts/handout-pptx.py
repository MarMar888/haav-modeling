"""Builds public/haav-handout.pptx: the /handout page as native, editable PowerPoint shapes and text boxes.

Canva imports .pptx with its text and shapes still editable (File > Import files, or Create a design > Import file).
The page itself (src/app/handout/page.tsx) is the source of truth; this copies its wording and layout, so re-run it
after the page changes:

  python3 scripts/handout-pptx.py <hull.png>

hull.png is public/haav-hull.webp converted to PNG.
Needs `pip install python-pptx pillow`.
"""

import re
import sys
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
HULL = Path(sys.argv[1])
OUT = ROOT / "public" / "haav-handout.pptx"

FONT = "Arial"
PAPER, INK, SOFT, RED, CARD, EDGE, FADED = (
    RGBColor.from_string(h) for h in ("FFFFFF", "111111", "555555", "C5050C", "F5F5F5", "F5F5F5", "BBBBBB")
)

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(8.5), Inches(11)
slide = prs.slides.add_slide(prs.slide_layouts[6])


Y_SHIFT = 0.0  # lets whole sections move together


def box(x, y, w, h, fill=None, line=None, radius=None, name=None):
    y += Y_SHIFT
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius:
        shape.adjustments[0] = radius / min(w, h)
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(0.75)
    shape.shadow.inherit = False
    if name:
        shape.name = name
    return shape


def text(x, y, w, h, runs, size=10, color=INK, bold=False, align=PP_ALIGN.LEFT, spacing=None, anchor=MSO_ANCHOR.TOP, name=None):
    """runs: a string, or a list of paragraphs, each a string or a list of (text, {bold, color}) runs."""
    y += Y_SHIFT
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        tb.name = name
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    paragraphs = [runs] if isinstance(runs, str) else runs
    for i, para in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if spacing:
            p.line_spacing = spacing
        for seg in [(para, {})] if isinstance(para, str) else para:
            t, o = seg
            r = p.add_run()
            r.text = t
            r.font.name = FONT
            r.font.size = Pt(o.get("size", size))
            r.font.bold = o.get("bold", bold)
            r.font.color.rgb = o.get("color", color)
    return tb


def read_timeline():
    """The date and title of each milestone in src/lib/timeline.ts (the handout leaves out the long descriptions)."""
    src = (ROOT / "src" / "lib" / "timeline.ts").read_text(encoding="utf-8")
    body = src[src.index("= [", src.index("export const TIMELINE")):]
    steps = []
    for block in re.findall(r"\{(.*?)\}", body, re.S):
        fields = dict(re.findall(r'(\w+):\s*"((?:[^"\\]|\\.)*)"', block))
        if "when" in fields and "label" in fields:
            steps.append((fields["when"], fields["label"]))
    return steps


def hull_on_paper():
    """The hull render has a white background; multiply it onto the paper colour so it sits on the page unframed."""
    from PIL import Image

    img = Image.open(HULL).convert("RGB")
    paper = (0xFF, 0xFF, 0xFF)
    out = Image.eval(img, lambda v: v)  # copy
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b = px[x, y]
            px[x, y] = (r * paper[0] // 255, g * paper[1] // 255, b * paper[2] // 255)
    path = Path("/tmp/haav-hull-paper.png")
    out.save(path)
    return path


def heading(x, y, s, size=14):
    text(x, y, 7.2, 0.3, s, size=size, bold=True, name=f"Heading: {s}")


LEFT = 0.55
CONTENT_W = 8.5 - 2 * LEFT
R = 0.16  # card corner radius

# paper
box(0, 0, 8.5, 11, fill=PAPER, name="Paper")

# header
text(LEFT, 0.36, 3, 0.7, "HaaV", size=36, bold=True, name="Title")
text(LEFT, 1.04, 4, 0.22, "Highly amphibious / autonomous Vessel", size=9.75, color=SOFT, name="Subtitle")
text(8.5 - LEFT - 3.5, 0.4, 3.5, 0.4, "Team: UW–Madison", size=19.5, bold=True, color=RED, align=PP_ALIGN.RIGHT, name="UW-Madison")
text(8.5 - LEFT - 3.5, 0.8, 3.5, 0.22, "College of Engineering", size=9.75, color=SOFT, align=PP_ALIGN.RIGHT, name="College of Engineering")

# hero (the page pulls it closer to the header)
Y_SHIFT = -0.12
text(LEFT, 1.62, 4.9, 1.2, "We are a student team building an uncrewed autonomous boat from the ground up.", size=22.5, bold=True, spacing=1.0, name="Headline")
hull = slide.shapes.add_picture(str(hull_on_paper()), Inches(8.5 - LEFT - 1.9), Inches(1.28 + Y_SHIFT), width=Inches(1.9))
hull.rotation = -3
hull.name = "Hull render"

# quick facts (three small cards)
features = [("30 mph", "Autonomously"), ("Integrated", "Software and controller"), ("Realtime LTE", "With LoRa backup")]
fw, fgap = (CONTENT_W - 0.25) / 3, 0.125
for i, (value, caption) in enumerate(features):
    x = LEFT + i * (fw + fgap)
    box(x, 3.0, fw, 0.6, fill=CARD, line=EDGE, radius=R, name=f"Fact card: {caption}")
    text(x + 0.15, 3.05, fw - 0.3, 0.35, value, size=16.5, bold=True, name=f"Fact: {value}")
    text(x + 0.15, 3.38, fw - 0.3, 0.2, caption, size=8.6, color=SOFT, name=f"Fact label: {caption}")

# model card
box(LEFT, 3.76, CONTENT_W, 1.05, fill=CARD, line=EDGE, radius=R, name="Model card")
text(LEFT + 0.17, 3.86, CONTENT_W - 0.34, 0.3, "Ground up means simulation + modeling first", size=12.75, bold=True, name="Model title")
text(
    LEFT + 0.17, 4.14, CONTENT_W - 0.34, 0.65,
    "We are building the model from first principles, mixing empirical and rule-of-thumb decisions with dynamic programming. Each constraint cuts the space of possible boats, and our model finds the fastest one based on current variables. As we build and test, we keep updating the model and adding constraints: a hybrid of simulation and empirical data.",
    size=8.6, color=SOFT, spacing=1.2, name="Model text",
)

# engineers
heading(LEFT, 4.98, "Engineers from across UW–Madison", size=12.75)
text(LEFT, 5.27, CONTENT_W, 0.2, "Lead members have interned at Tesla, Northrop Grumman, Xcel Energy, Fincantieri and Milwaukee Tool.", size=9, color=SOFT, name="Engineers text")
disciplines = [
    ("Industrial", "Optimization, composites and manufacturing"),
    ("Mechanical", "Structures, CAD, fabrication"),
    ("Electrical", "Power, battery and high voltage"),
    ("Computer", "Firmware, software, controls"),
]
step = (CONTENT_W + 0.25) / 4
for i, (name, covers) in enumerate(disciplines):
    x = LEFT + i * step
    text(x, 5.52, step - 0.2, 0.2, name, size=9.5, bold=True, name=f"Discipline: {name}")
    text(x, 5.72, step - 0.3, 0.4, covers, size=8.6, color=SOFT, spacing=1.1, name=f"Discipline text: {name}")

# phases (three cards)
heading(LEFT, 6.17, "Our primary phases", size=12.75)
cards = [
    ("Hull", "Plane fast and stay light.", ["Hybrid planing composite hull", "Dimensions shaped by weight", "Optimization shaped by hydrodynamics"]),
    ("Electric", "Every watt-hour to speed.", ["High-voltage battery storage", "Propulsion sized by the model", "Propulsion and cooling co-designed"]),
    ("Autonomous", "Manage drift and controls.", ["GPS, IMU and LIDAR sensing", "Fundamental feedback protocols", "Software plans the route"]),
]
cw, cgap = (CONTENT_W - 0.25) / 3, 0.125
for i, (title, strategy, points) in enumerate(cards):
    x = LEFT + i * (cw + cgap)
    box(x, 6.45, cw, 1.3, fill=CARD, line=EDGE, radius=R, name=f"Card: {title}")
    text(x + 0.15, 6.61, cw - 0.3, 0.25, title, size=11.25, bold=True, name=f"Part: {title}")
    text(x + 0.15, 6.84, cw - 0.3, 0.2, strategy, size=9, color=INK, bold=True, name=f"Part tagline: {title}")
    text(x + 0.15, 7.1, cw - 0.3, 0.6, points, size=8.2, color=SOFT, spacing=1.2, name=f"Part points: {title}")

# timeline: dates and titles only, two balanced columns, read from src/lib/timeline.ts
heading(LEFT, 7.93, "Timeline", size=12.75)
steps = read_timeline()
colw = (CONTENT_W - 0.333) / 2
label_w = colw - 1.05
chars_per_line = int(label_w / 0.05)  # 8.2 pt Arial
ys = [8.24, 8.24]
for i, (when, what) in enumerate(steps):
    col = 0 if i < 6 else 1
    x = LEFT + col * (colw + 0.333)
    lines = -(-len(what) // chars_per_line)
    h = 0.178 + (lines - 1) * 0.125
    text(x, ys[col], 1.1, 0.18, when, size=8.2, color=INK, bold=True, name=f"Timeline date: {what}")
    text(x + 1.05, ys[col], label_w, h, what, size=8.2, color=SOFT, name=f"Timeline label: {what}")
    ys[col] += h

# footer (card) stays put
Y_SHIFT = 0.0
box(LEFT, 9.65, CONTENT_W, 0.9, fill=INK, radius=R, name="Footer card")
text(LEFT + 0.2, 9.8, 3.8, 0.3, "Want to get involved?", size=14.25, bold=True, color=PAPER, name="Footer title")
text(LEFT + 0.2, 10.1, 3.6, 0.4, "We are looking for funds, parts, advisors and supporters. Email Marley or head to our site for more information.", size=9, color=FADED, spacing=1.15, name="Footer text")
text(8.5 - LEFT - 3.4, 9.78, 3.2, 0.3, "bit.ly/haav", size=14.25, bold=True, color=PAPER, align=PP_ALIGN.RIGHT, name="Footer link")
text(8.5 - LEFT - 3.4, 10.1, 3.2, 0.2, "Marley Barrett, Project lead", size=9, bold=True, color=PAPER, align=PP_ALIGN.RIGHT, name="Footer contact name")
text(8.5 - LEFT - 3.4, 10.28, 3.2, 0.2, "mhbarrett@wisc.edu", size=9, color=FADED, align=PP_ALIGN.RIGHT, name="Footer contact email")

prs.save(OUT)
print(f"wrote {OUT}")
