# /// script
# requires-python = ">=3.11"
# dependencies = ["brotli==1.2.0", "perfectclone @ git+https://github.com/eshaangulati123/rea-website.git@fb880fb65b51d5fd253fe88df35ff3a8e4b3f488"]
# ///

import argparse
from functools import lru_cache, partial
import gzip
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import sys
from urllib.parse import urlsplit

import brotli
from perfectclone.serve import Handler

from preview_assets import local_copy, needs_branding, render_document


COMPRESSIBLE = {".html", ".css", ".js", ".mjs", ".json", ".rsc", ".svg", ".txt", ".xml"}
MEDIA = {".avif", ".gif", ".ico", ".jpeg", ".jpg", ".mp4", ".png", ".webm", ".webp"}


def accepted_encoding(header):
    weights = {}
    for value in header.split(","):
        encoding, separator, quality = value.strip().lower().partition(";")
        weight = 1.0
        if separator:
            parameter, _, number = quality.strip().partition("=")
            try:
                weight = float(number) if parameter.strip() == "q" else 0.0
            except ValueError:
                weight = 0.0
        if 0 <= weight <= 1:
            weights[encoding.strip()] = weight

    wildcard = weights.get("*", 0)
    candidates = ("br", "gzip")
    encoding = max(candidates, key=lambda name: weights.get(name, wildcard))
    if weights.get(encoding, wildcard) >= weights.get("identity", 0) and weights.get(encoding, wildcard) > 0:
        return encoding
    return None


@lru_cache(maxsize=128)
def compressed_file(path, version, encoding):
    # Include the file version in the cache key so edits appear on the next request.
    content = render_document(path).encode() if needs_branding(path) else path.read_bytes()
    if encoding == "br":
        return brotli.compress(content, quality=5)
    if encoding == "gzip":
        return gzip.compress(content, compresslevel=5, mtime=0)
    return content


class PreviewServer(ThreadingHTTPServer):
    # Next.js prefetches several navigation payloads for each visible link.
    request_queue_size = 128

    def handle_error(self, request, client_address):
        if not isinstance(sys.exception(), (BrokenPipeError, ConnectionResetError)):
            super().handle_error(request, client_address)


class PreviewHandler(Handler):
    def translate_path(self, path):
        source = super().translate_path(path)
        return local_copy(source, self.directory)

    def send_head(self):
        request_path = Path(urlsplit(self.path).path)
        if self.headers.get("Range") and request_path.suffix in MEDIA:
            return super().send_head()

        self.redirect_to = None
        self.route()
        if self.redirect_to:
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", self.redirect_to)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        path = Path(self.translate_path(self.path))
        if path.suffix.lower() not in COMPRESSIBLE:
            return SimpleHTTPRequestHandler.send_head(self)
        encoding = accepted_encoding(self.headers.get("Accept-Encoding", ""))
        branded = needs_branding(path)
        if not encoding and not branded:
            return SimpleHTTPRequestHandler.send_head(self)

        try:
            stat = path.stat()
            if not path.is_file() or (not branded and stat.st_size < 1024):
                return SimpleHTTPRequestHandler.send_head(self)
            version = (stat.st_mtime_ns, stat.st_size)
            body = compressed_file(path, version, encoding)
        except OSError:
            return SimpleHTTPRequestHandler.send_head(self)

        revision = "-slash4" if branded else ""
        etag = f'"{version[0]:x}-{version[1]:x}{revision}-{encoding or "identity"}"'
        validators = {tag.strip().removeprefix("W/") for tag in self.headers.get("If-None-Match", "").split(",")}
        if etag in validators or "*" in validators:
            self.send_response(HTTPStatus.NOT_MODIFIED)
            self.send_header("ETag", etag)
            self.end_headers()
            return None

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", self.guess_type(path))
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
        self.send_header("ETag", etag)
        self.end_headers()
        return BytesIO(body)

    def send_response(self, code, message=None):
        self.response_status = code
        super().send_response(code, message)

    def end_headers(self):
        path = urlsplit(self.path).path
        suffix = Path(path).suffix.lower()
        if suffix in COMPRESSIBLE:
            self.send_header("Vary", "Accept-Encoding")
        if self.response_status in (HTTPStatus.OK, HTTPStatus.PARTIAL_CONTENT, HTTPStatus.NOT_MODIFIED):
            if path.startswith("/_next/static/media/") and suffix in {".woff", ".woff2"}:
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            elif suffix in MEDIA or (
                path.startswith("/_next/static/chunks/")
                and suffix in {".js", ".mjs"}
                and not needs_branding(Path(path))
            ):
                self.send_header("Cache-Control", "public, max-age=3600")
            else:
                self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def send_error(self, code, message=None, explain=None):
        suffix = Path(urlsplit(self.path).path).suffix
        if code != HTTPStatus.NOT_FOUND or suffix not in ("", ".html") or self.headers.get("RSC") == "1":
            return super().send_error(code, message, explain)

        fallback = Path(self.translate_path("/404.html"))
        if not fallback.is_file():
            return super().send_error(code, message, explain)

        body = render_document(fallback).encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser(description="Serve the Slash Wallet preview locally.")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    site = Path(__file__).resolve().parent / "site"
    handler = partial(PreviewHandler, directory=str(site))
    with PreviewServer(("127.0.0.1", args.port), handler) as server:
        print(f"Serving {site} at http://localhost:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
