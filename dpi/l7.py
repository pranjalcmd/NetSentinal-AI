"""L7 deep packet inspection — Python port of the Packet_analyzer C++ engine.

Ported from Packet_analyzer-main so the DPI path does real application
identification on any platform, with no C++ toolchain. The upstream binary is
a macOS/Linux build (Mach-O ARM64 in the drop) and prints an aggregate ASCII
report rather than per-flow records, so it cannot feed the Flow schema; the
logic it implements can, which is what this module is.

Faithful to the originals, including bounds checks and match ordering:

  src/sni_extractor.cpp  SNIExtractor::isTLSClientHello / ::extract
  src/sni_extractor.cpp  HTTPHostExtractor::extract  (case-insensitive Host:)
  src/sni_extractor.cpp  DNSExtractor::extractQuery
  src/types.cpp          sniToAppType / appTypeToString

Match order is load-bearing: upstream tests "google"/"ggpht" before "youtube",
so yt3.ggpht.com classifies as Google. Preserved deliberately — see
test_l7.py::test_ggpht_matches_google_not_youtube.

Self-check (from netsentinel/): python -m dpi.l7
"""
from __future__ import annotations

import struct

# TLS record / handshake constants (sni_extractor.h).
CONTENT_TYPE_HANDSHAKE = 0x16
HANDSHAKE_CLIENT_HELLO = 0x01
EXTENSION_SNI = 0x0000
SNI_TYPE_HOSTNAME = 0x00


# ----------------------------------------------------------------------
# TLS SNI
# ----------------------------------------------------------------------

def is_tls_client_hello(payload: bytes) -> bool:
    if len(payload) < 9:
        return False
    if payload[0] != CONTENT_TYPE_HANDSHAKE:
        return False
    # SSL 3.0 (0x0300) through TLS 1.3 (0x0304).
    version = struct.unpack(">H", payload[1:3])[0]
    if version < 0x0300 or version > 0x0304:
        return False
    record_length = struct.unpack(">H", payload[3:5])[0]
    if record_length > len(payload) - 5:
        return False
    return payload[5] == HANDSHAKE_CLIENT_HELLO


def extract_sni(payload: bytes) -> str | None:
    """Server name from a TLS Client Hello, or None.

    The domain is plaintext in the first packet even for HTTPS, which is what
    makes app identification possible without decryption.
    """
    if not is_tls_client_hello(payload):
        return None

    n = len(payload)
    offset = 5 + 4          # record header + handshake header
    offset += 2 + 32        # client version + random

    if offset >= n:
        return None
    offset += 1 + payload[offset]            # session id

    if offset + 2 > n:
        return None
    offset += 2 + struct.unpack(">H", payload[offset:offset + 2])[0]   # cipher suites

    if offset >= n:
        return None
    offset += 1 + payload[offset]            # compression methods

    if offset + 2 > n:
        return None
    extensions_length = struct.unpack(">H", payload[offset:offset + 2])[0]
    offset += 2

    # Upstream clamps rather than rejecting, so a truncated capture still parses.
    extensions_end = min(offset + extensions_length, n)

    while offset + 4 <= extensions_end:
        ext_type = struct.unpack(">H", payload[offset:offset + 2])[0]
        ext_len = struct.unpack(">H", payload[offset + 2:offset + 4])[0]
        offset += 4
        if offset + ext_len > extensions_end:
            break

        if ext_type == EXTENSION_SNI:
            if ext_len < 5:
                break
            sni_list_length = struct.unpack(">H", payload[offset:offset + 2])[0]
            if sni_list_length < 3:
                break
            if payload[offset + 2] != SNI_TYPE_HOSTNAME:
                break
            sni_length = struct.unpack(">H", payload[offset + 3:offset + 5])[0]
            if sni_length > ext_len - 5:
                break
            name = payload[offset + 5:offset + 5 + sni_length]
            # Upstream builds a std::string from raw bytes; a mangled capture
            # must not raise here.
            return name.decode("ascii", "ignore") or None

        offset += ext_len

    return None


# ----------------------------------------------------------------------
# HTTP Host header
# ----------------------------------------------------------------------

_HTTP_METHODS = (b"GET ", b"POST", b"PUT ", b"HEAD", b"DELE", b"PATC", b"OPTI")


def is_http_request(payload: bytes) -> bool:
    return len(payload) >= 4 and payload[:4] in _HTTP_METHODS


def extract_http_host(payload: bytes) -> str | None:
    """Host header value with any :port stripped, or None."""
    if not is_http_request(payload):
        return None

    head = payload[:2048]                      # headers only; bound the scan
    lowered = head.lower()
    index = lowered.find(b"host:")
    if index == -1:
        return None

    start = index + 5
    while start < len(head) and head[start] in (0x20, 0x09):   # space / tab
        start += 1
    end = start
    while end < len(head) and head[end] not in (0x0D, 0x0A):   # CR / LF
        end += 1
    if end <= start:
        return None

    host = head[start:end].decode("ascii", "ignore")
    return host.split(":")[0] or None


# ----------------------------------------------------------------------
# DNS query name
# ----------------------------------------------------------------------

def is_dns_query(payload: bytes) -> bool:
    if len(payload) < 12:
        return False
    if payload[2] & 0x80:                      # QR bit set -> response
        return False
    return struct.unpack(">H", payload[4:6])[0] != 0    # QDCOUNT


def extract_dns_query(payload: bytes) -> str | None:
    """Fully-qualified name from the first DNS question, or None.

    The name itself is what a DGA/tunneling detector needs — character entropy
    and label length live here, not in the packet counters.
    """
    if not is_dns_query(payload):
        return None

    offset = 12
    labels: list[str] = []
    n = len(payload)
    while offset < n:
        label_length = payload[offset]
        if label_length == 0:
            break
        if label_length > 63:                  # compression pointer / invalid
            break
        offset += 1
        if offset + label_length > n:
            break
        labels.append(payload[offset:offset + label_length].decode("ascii", "ignore"))
        offset += label_length

    return ".".join(labels) or None


# ----------------------------------------------------------------------
# SNI / hostname -> application
# ----------------------------------------------------------------------

# Ordered exactly as the C++ if-chain in types.cpp. First hit wins.
_APP_SIGNATURES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Google",     ("google", "gstatic", "googleapis", "ggpht", "gvt1")),
    ("YouTube",    ("youtube", "ytimg", "youtu.be", "yt3.ggpht")),
    ("Facebook",   ("facebook", "fbcdn", "fb.com", "fbsbx", "meta.com")),
    ("Instagram",  ("instagram", "cdninstagram")),
    ("WhatsApp",   ("whatsapp", "wa.me")),
    ("Twitter/X",  ("twitter", "twimg", "x.com", "t.co")),
    ("Netflix",    ("netflix", "nflxvideo", "nflximg")),
    ("Amazon",     ("amazon", "amazonaws", "cloudfront", "aws")),
    ("Microsoft",  ("microsoft", "msn.com", "office", "azure", "live.com",
                    "outlook", "bing")),
    ("Apple",      ("apple", "icloud", "mzstatic", "itunes")),
    ("Telegram",   ("telegram", "t.me")),
    ("TikTok",     ("tiktok", "tiktokcdn", "musical.ly", "bytedance")),
    ("Spotify",    ("spotify", "scdn.co")),
    ("Zoom",       ("zoom",)),
    ("Discord",    ("discord", "discordapp")),
    ("GitHub",     ("github", "githubusercontent")),
    ("Cloudflare", ("cloudflare", "cf-")),
)


def _matches(lowered: str, needle: str) -> bool:
    """One signature test.

    Deviation from upstream, deliberate: types.cpp uses a bare substring
    search for every needle, which misfires on dotted ones —
    "x.com" matches netfli(x.com) and "t.co" matches microsof(t.co)m, and
    since Twitter/X is tested before Netflix and Microsoft, both of those
    real domains classify as Twitter. Verified against their own
    test_dpi.pcap before the fix.

    So a needle containing a dot must match whole DNS labels (dot-padding
    both sides makes that a plain substring test), while a bare word keeps
    upstream's substring behaviour — that is what makes "google" catch
    googleapis.com and "fbcdn" catch fbcdn.net.
    """
    if "." in needle:
        return f".{needle}." in f".{lowered}."
    return needle in lowered


def classify_hostname(name: str | None) -> str:
    """Application label for an SNI/Host value.

    Returns "HTTPS" for a recognized-but-unlisted domain (upstream behaviour:
    an SNI proves TLS even when the brand is unknown) and "Unknown" for none.
    """
    if not name:
        return "Unknown"
    lowered = name.lower().rstrip(".")
    for app, needles in _APP_SIGNATURES:
        if any(_matches(lowered, needle) for needle in needles):
            return app
    return "HTTPS"


def inspect(payload: bytes, sport: int | None, dport: int | None) -> dict:
    """Run every extractor over one L4 payload.

    Returns {} when nothing is found, so callers can cheaply skip.
    """
    if not payload:
        return {}

    sni = extract_sni(payload)
    if sni:
        return {"sni": sni, "l7_app": classify_hostname(sni), "l7_proto": "TLS"}

    host = extract_http_host(payload)
    if host:
        app = classify_hostname(host)
        # classify_hostname falls back to "HTTPS" for an unlisted brand, which
        # is wrong as an app label on a cleartext HTTP flow.
        return {"hostname": host,
                "l7_app": "HTTP" if app == "HTTPS" else app,
                "l7_proto": "HTTP"}

    if 53 in (sport, dport):
        query = extract_dns_query(payload)
        if query:
            return {"dns_query": query, "l7_app": "DNS", "l7_proto": "DNS"}

    return {}


if __name__ == "__main__":
    # Build a real Client Hello for www.youtube.com and parse it back.
    host = b"www.youtube.com"
    sni_ext = (struct.pack(">HH", 0x0000, len(host) + 5)
               + struct.pack(">H", len(host) + 3)
               + b"\x00" + struct.pack(">H", len(host)) + host)
    body = (b"\x03\x03" + b"\xAA" * 32 + b"\x00"      # version, random, no session
            + struct.pack(">H", 2) + b"\x13\x01"       # one cipher suite
            + b"\x01\x00"                              # one compression method
            + struct.pack(">H", len(sni_ext)) + sni_ext)
    handshake = b"\x01" + len(body).to_bytes(3, "big") + body
    hello = b"\x16\x03\x01" + struct.pack(">H", len(handshake)) + handshake

    assert extract_sni(hello) == "www.youtube.com", extract_sni(hello)
    assert classify_hostname("www.youtube.com") == "YouTube"
    # Upstream order: ggpht hits the Google branch first.
    assert classify_hostname("yt3.ggpht.com") == "Google"
    assert classify_hostname("bank.example.com") == "HTTPS"
    assert classify_hostname(None) == "Unknown"

    # The two upstream substring misfires, fixed by label-boundary matching.
    assert classify_hostname("www.netflix.com") == "Netflix"      # not Twitter/X
    assert classify_hostname("www.microsoft.com") == "Microsoft"  # not Twitter/X
    # ...without losing the genuine short domains they were there for.
    assert classify_hostname("x.com") == "Twitter/X"
    assert classify_hostname("t.co") == "Twitter/X"
    assert classify_hostname("audio.scdn.co") == "Spotify"

    req = b"GET /index.html HTTP/1.1\r\nHost: github.com:8080\r\n\r\n"
    assert extract_http_host(req) == "github.com"

    dns = (b"\xab\xcd\x01\x00" + struct.pack(">HHHH", 1, 0, 0, 0)
           + b"\x03www\x07example\x03com\x00" + struct.pack(">HH", 1, 1))
    assert extract_dns_query(dns) == "www.example.com"
    assert extract_dns_query(b"\x00" * 12) is None

    # Truncation must degrade to None, never raise.
    for cut in range(len(hello)):
        extract_sni(hello[:cut])

    assert inspect(hello, 49152, 443)["l7_app"] == "YouTube"
    assert inspect(b"", None, None) == {}
    print("l7 self-check ok")
