# /// script
# requires-python = ">=3.11"
# dependencies = ["perfectclone @ git+https://github.com/eshaangulati123/rea-website.git@fb880fb65b51d5fd253fe88df35ff3a8e4b3f488"]
# ///

import argparse
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

from perfectclone.flight import edit_flight, map_rows, outside_flight

from preview_assets import local_copy, needs_branding, render_document


SOURCE = Path(__file__).resolve().parent / "site"
CAPTURE_ORIGIN = "https://splashwallet.xyz"
TEXT_ASSETS = {".css", ".js", ".mjs", ".xml"}
ROOT_LINK = re.compile(r'(\bhref="|\\"href\\":\\"|"href":")/(?=\\?")')
FLIGHT_FAVICON = re.compile(r'("href":")/favicon\.ico[^"]*(")')


def replace_once(text, old, new, filename):
    if text.count(old) != 1:
        raise ValueError(f"Unexpected Next.js runtime in {filename}: {old}")
    return text.replace(old, new, 1)


def build_pages(output, base_path, origin):
    roots = "|".join(re.escape(path.name) for path in SOURCE.iterdir() if path.is_dir())
    paths = re.compile(
        rf"(?<![\w./:}}\\-])/(?=(?:{roots})(?=[/\s?#\u0022\u0027\\`])"
        r"|slash-[\w-]+\.(?:css|js|svg)|favicon\.ico)"
    )
    hosted_origin = origin + base_path
    base = json.dumps(base_path)

    def local_urls(text):
        return paths.sub(base_path + "/", text)

    def page_urls(text):
        text = local_urls(text)
        text = ROOT_LINK.sub(lambda match: match[1] + base_path + "/", text)
        return text.replace(CAPTURE_ORIGIN + "/", hosted_origin + "/")

    def flight_row(row):
        row = FLIGHT_FAVICON.sub(r'\1/slash-mark.svg\2', row)
        if row.startswith('0:{"P":null,"c":["",'):
            row = row.replace('"c":["",', f'"c":["",{json.dumps(base_path[1:])},', 1)
        return page_urls(row)

    def javascript(text, name):
        if name.startswith("turbopack-"):
            text = replace_once(text, ':"/_next/",P=new Map', f':{json.dumps(base_path + "/_next/")},P=new Map', name)
        elif name == "14x-gv6879ywq.js":
            text = replace_once(
                text, '(0,n.addPathPrefix)(e,"")',
                f'(0,n.addPathPrefix)(e,e==={base}||e.startsWith({base}+"/")?"":{base})', name,
            )
            text = replace_once(text, '(0,n.pathHasPrefix)(e,"")', f'(0,n.pathHasPrefix)(e,{base})', name)
            text = replace_once(text, '87250,(e,t,r)=>{"use strict";function n(e){return e}',
                f'87250,(e,t,r)=>{{"use strict";function n(e){{return e.slice({len(base_path)})||"/"}}', name)
        text = text.replace(
            'e.s(["z",0,"","x",0,e=>`${e}`])',
            f'e.s(["z",0,{base},"x",0,e=>e.startsWith({base}+"/")?e:{base}+e])',
        )
        text = text.replace('${t.assetPrefix}/_next/', '${t.assetPrefix||' + base + '}/_next/')
        # Asset helpers handle runtime image URLs. The remaining rooted strings include
        # ordinary anchors, static URL values, and precomputed srcset entries.
        return local_urls(text)

    output.mkdir(parents=True, exist_ok=True)
    for file in SOURCE.rglob("*"):
        if not file.is_file():
            continue
        path = file.relative_to(SOURCE)
        source = Path(local_copy(str(file), SOURCE))
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if file.suffix in TEXT_ASSETS or needs_branding(file):
            document = render_document(source) if needs_branding(file) else source.read_text()
            if file.suffix == ".html":
                document = edit_flight(outside_flight(document, page_urls), flight_row)
            elif file.suffix == ".js":
                document = javascript(document, file.name)
            elif file.suffix == ".txt" or file.suffix == ".rsc":
                document = map_rows(document, flight_row)
            elif file.suffix == ".xml":
                document = document.replace(CAPTURE_ORIGIN + "/", hosted_origin + "/")
            else:
                document = local_urls(document)
            target.write_text(document)
        else:
            shutil.copyfile(source, target)
    (output / ".nojekyll").touch()
    (output / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {hosted_origin}/sitemap.xml\n")


def main():
    parser = argparse.ArgumentParser(description="Export Slash for GitHub Pages.")
    parser.add_argument("output", type=Path)
    parser.add_argument("--base-path", default="/slash")
    parser.add_argument("--origin", default="https://odhasu.github.io")
    args = parser.parse_args()
    destination = args.output.resolve()
    if destination.is_relative_to(SOURCE) or destination.exists() and any(destination.iterdir()):
        parser.error("Use a new or empty output folder outside the capture.")
    if not re.fullmatch(r"/[\w-]+", args.base_path):
        parser.error("Base path must be one slash followed by the repository name.")
    origin = urlsplit(args.origin)
    if origin.scheme not in {"http", "https"} or not origin.netloc or origin.path not in {"", "/"}:
        parser.error("Origin must include the scheme and hostname.")
    build_pages(destination, args.base_path, args.origin.rstrip("/"))


if __name__ == "__main__":
    main()
