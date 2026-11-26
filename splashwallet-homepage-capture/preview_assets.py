import os
import re
import shutil
import stat
from pathlib import Path
from tempfile import NamedTemporaryFile

from perfectclone.flight import edit_flight, map_rows, outside_flight


LOCAL_ASSETS = Path.home() / "Library/Application Support/Slash Preview/site"
BRAND = re.compile(
    r"(?<![\w./@#-])(?:Splash|splash|SPLASH)(?![\w/-]|:[A-Za-z/]|\.[A-Za-z0-9])"
)
BRAND_NAMES = {"Splash": "Slash", "splash": "slash", "SPLASH": "SLASH"}
FAVICON = re.compile(r'<link\b[^>]*rel="icon"[^>]*>')
BRANDED_SCRIPTS = frozenset({
    "033wdq8jol78t.js",
    "0mazxsj6_f611.js",
    "0yeqgiey7ncxd.js",
    "1cjwn-_bnfxk1.js",
    "1gbziif24tn_p.js",
    "1w2y-5yv52td4.js",
    "1zb59gm6j3vtt.js",
    "2kqxda00vmze3.js",
    "2lkdzn57eq-v6.js",
    "42amdh4zah026.js",
})
MOTION_ASSETS = (
    '<link rel="stylesheet" href="/slash-theme.css"/>'
    '<script src="/slash-gradients.js" async=""></script>'
)


def local_copy(source, directory):
    """Use a resident copy only when it matches the workspace file."""
    path = Path(source)
    try:
        candidate = LOCAL_ASSETS / path.relative_to(directory)
        current = path.stat()
        if not stat.S_ISREG(current.st_mode):
            return source
        cached = candidate.stat() if candidate.is_file() else None
    except (OSError, ValueError):
        return source
    if cached and (cached.st_size, cached.st_mtime_ns) == (current.st_size, current.st_mtime_ns):
        return str(candidate)
    if getattr(current, "st_flags", 0) & getattr(stat, "SF_DATALESS", 0):
        return source
    try:
        candidate.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(dir=candidate.parent, delete=False) as copy:
            staged = Path(copy.name)
            try:
                with path.open("rb") as original:
                    shutil.copyfileobj(original, copy)
                copy.flush()
                if copy.tell() != current.st_size or path.stat().st_mtime_ns != current.st_mtime_ns:
                    return source
                os.utime(staged, ns=(current.st_atime_ns, current.st_mtime_ns))
                staged.replace(candidate)
                return str(candidate)
            finally:
                staged.unlink(missing_ok=True)
    except OSError:
        return source


def needs_branding(path):
    return (
        path.suffix in {".html", ".rsc"}
        or path.name == "index.txt"
        or path.name.startswith("__next.") and path.suffix == ".txt"
        or path.name in BRANDED_SCRIPTS
    )


def rename_brand(text):
    return BRAND.sub(lambda match: BRAND_NAMES[match[0]], text)


def render_document(path):
    document = path.read_text()
    if path.name in BRANDED_SCRIPTS:
        return rename_brand(document)
    if path.suffix == ".html":
        def edit_markup(markup):
            markup = FAVICON.sub('<link rel="icon" href="/slash-mark.svg" type="image/svg+xml"/>', markup)
            return rename_brand(markup).replace("</head>", MOTION_ASSETS + "</head>", 1)

        return edit_flight(outside_flight(document, edit_markup), rename_brand)
    return map_rows(document, rename_brand)
