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
FAVICON = re.compile(r'/favicon\.ico(?:\?favicon\.[\w-]+\.ico)?(?=["\\])')
FAVICON_URL = "/favicon.ico?v=5"
LEGACY_APP = re.compile(r"https?://apps\.apple\.com/[^\s<>\"'\\]*id6746621525", re.I)
LEGACY_SOCIAL = re.compile(r"https?://(?:x|twitter)\.com/splashos/?", re.I)
LEGACY_EMAIL = re.compile(r"mailto:[.\w+-]+@splashwallet\.xyz", re.I)
LEGACY_ADDRESS = re.compile(r"\b[.\w+-]+@splashwallet\.xyz\b", re.I)
LEGACY_SITE = re.compile(r"https?://(?:www\.)?(?:splashwallet\.xyz|splash\.bid)(?:/|\b)", re.I)
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
    '<link rel="stylesheet" href="/slash-theme.css?v=3"/>'
    '<script src="/slash-gradients.js" async=""></script>'
    '<script type="module" src="/slash-scroll.js"></script>'
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


def remove_legacy_destinations(text, site_origin):
    text = LEGACY_APP.sub("#ios-download", text)
    text = LEGACY_SOCIAL.sub("#social-unavailable", text)
    text = LEGACY_EMAIL.sub("#contact-unavailable", text)
    text = LEGACY_ADDRESS.sub("Contact unavailable", text)
    text = text.replace("https://prod.splashwallet.xyz/categories", site_origin + "/markets/")
    text = LEGACY_SITE.sub(site_origin + "/", text)
    text = text.replace("Get Splash on the App Store", "Check iOS availability")
    text = text.replace("Get Splash for iOS", "Check iOS availability")
    text = text.replace("Splash is free on iPhone. Android coming soon.", "Slash for iOS and Android is coming soon.")
    return re.sub(r"\b(?:splashwallet\.xyz|splash\.bid)\b", "this website", text, flags=re.I)


def ios_placeholder(script):
    old_qr = (
        '(0,l.jsx)(R,{value:t,title:"Scan to open Splash in the App Store",role:"img",size:260,'
        'marginSize:4,level:"M",bgColor:"#FFFFFF",fgColor:"#0F0800",className:e})'
    )
    new_qr = (
        '(0,l.jsx)("img",{src:"/slash-preview-qr.svg",alt:"",width:260,height:260,'
        'className:e})'
    )
    old_open = (
        '()=>{/iPad|iPhone|iPod/.test(navigator.userAgent)||"MacIntel"===navigator.platform'
        '&&navigator.maxTouchPoints>1?window.location.assign(r??n.X):s(!0)},[r]'
    )
    for old, new in (
        (old_qr, new_qr),
        (old_open, '()=>s(!0),[]'),
        ('a[data-ios-download], a[href="${i}"]', 'a[data-ios-download], a[href="#ios-download"], a[href="${i}"]'),
        (
            """!t||t.closest('[role="dialog"]')||(e.preventDefault(),o())""",
            """if(t){e.preventDefault();t.closest('[role="dialog"]')?.querySelector('button[aria-label="Close"]')?.click();o()}""",
        ),
        ('"Scan the QR code to get Splash."', '"Slash for iOS is coming soon."'),
        ('"Already on your phone?"', '"Check back here for iOS availability."'),
        ('(0,t.jsxs)("a",{href:l,onClick:r,className:', '(0,t.jsxs)("span",{"aria-disabled":true,className:'),
        ('"Download for iOS"', '"Coming soon"'),
    ):
        if script.count(old) != 1:
            raise ValueError("Unexpected QR modal bundle. Update the iOS placeholder replacements.")
        script = script.replace(old, new, 1)
    return script


def render_document(path, site_origin=""):
    document = path.read_text()

    def edit(text):
        text = FAVICON.sub(FAVICON_URL, text)
        return rename_brand(remove_legacy_destinations(text, site_origin))

    if path.name == "1cjwn-_bnfxk1.js":
        return edit(ios_placeholder(document))
    if path.name in BRANDED_SCRIPTS:
        return edit(document)

    if path.suffix == ".html":
        def edit_markup(markup):
            return edit(markup).replace("</head>", MOTION_ASSETS + "</head>", 1)

        return edit_flight(outside_flight(document, edit_markup), edit)
    return map_rows(document, edit)
