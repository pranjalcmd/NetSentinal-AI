"""Tests for the Packet_analyzer L7 port (dpi/l7.py).

The upstream C++ binary in the drop is a Mach-O ARM64 build and cannot run
here, so these tests are the contract: they pin the parsers against
hand-built TLS/HTTP/DNS payloads and against the two captures shipped in the
Packet_analyzer drop when those are present.
"""
import struct
from pathlib import Path

import pytest

from dpi.l7 import (
    classify_hostname,
    extract_dns_query,
    extract_http_host,
    extract_sni,
    inspect,
    is_tls_client_hello,
)

# Captures shipped alongside the C++ source. Optional — the suite must pass
# without the drop present.
DROP = Path(r"C:\Users\pranj\OneDrive\Desktop\hacka\_zips\packet_analyzer\Packet_analyzer-main")


def client_hello(host: bytes, *, version: bytes = b"\x03\x01") -> bytes:
    """A real TLS Client Hello carrying `host` in the SNI extension."""
    sni_ext = (struct.pack(">HH", 0x0000, len(host) + 5)
               + struct.pack(">H", len(host) + 3)
               + b"\x00" + struct.pack(">H", len(host)) + host)
    body = (b"\x03\x03" + b"\xAA" * 32 + b"\x00"
            + struct.pack(">H", 2) + b"\x13\x01"
            + b"\x01\x00"
            + struct.pack(">H", len(sni_ext)) + sni_ext)
    handshake = b"\x01" + len(body).to_bytes(3, "big") + body
    return b"\x16" + version + struct.pack(">H", len(handshake)) + handshake


def dns_query(name: str) -> bytes:
    labels = b"".join(bytes([len(p)]) + p.encode() for p in name.split("."))
    return (b"\xab\xcd\x01\x00" + struct.pack(">HHHH", 1, 0, 0, 0)
            + labels + b"\x00" + struct.pack(">HH", 1, 1))


# ------------------------------------------------------------------ TLS SNI

def test_extracts_sni():
    assert extract_sni(client_hello(b"www.youtube.com")) == "www.youtube.com"


def test_long_sni_with_session_and_ciphers():
    host = b"very-long-subdomain.cdn.example-service.co.uk"
    assert extract_sni(client_hello(host)) == host.decode()


def test_rejects_non_handshake_and_bad_version():
    hello = client_hello(b"a.com")
    assert is_tls_client_hello(hello)
    # Content type 0x17 = application data, not a handshake.
    assert not is_tls_client_hello(b"\x17" + hello[1:])
    # 0x0399 is outside SSL3.0 - TLS1.3.
    assert extract_sni(client_hello(b"a.com", version=b"\x03\x99")) is None


def test_truncated_hello_never_raises():
    """A capture cut mid-handshake must return None, not blow up the reader."""
    hello = client_hello(b"www.github.com")
    for cut in range(len(hello) + 1):
        extract_sni(hello[:cut])          # must not raise
    assert extract_sni(hello[:40]) is None


def test_no_sni_extension():
    """A Client Hello with only a non-SNI extension yields nothing."""
    other = struct.pack(">HH", 0x000B, 2) + b"\x01\x00"   # ec_point_formats
    body = (b"\x03\x03" + b"\xAA" * 32 + b"\x00"
            + struct.pack(">H", 2) + b"\x13\x01" + b"\x01\x00"
            + struct.pack(">H", len(other)) + other)
    handshake = b"\x01" + len(body).to_bytes(3, "big") + body
    hello = b"\x16\x03\x01" + struct.pack(">H", len(handshake)) + handshake

    assert extract_sni(hello) is None


# ------------------------------------------------------------------ HTTP

@pytest.mark.parametrize("raw,expected", [
    (b"GET / HTTP/1.1\r\nHost: github.com\r\n\r\n", "github.com"),
    (b"POST /x HTTP/1.1\r\nHost: api.example.com:8443\r\n\r\n", "api.example.com"),
    (b"HEAD / HTTP/1.1\r\nhost:\twww.lower.com\r\n\r\n", "www.lower.com"),
    (b"GET / HTTP/1.1\r\nUser-Agent: x\r\nHost: second.com\r\n\r\n", "second.com"),
])
def test_extracts_http_host(raw, expected):
    assert extract_http_host(raw) == expected


def test_ignores_non_http_and_missing_host():
    assert extract_http_host(b"\x16\x03\x01\x00\x10rubbish") is None
    assert extract_http_host(b"GET / HTTP/1.1\r\n\r\n") is None


# ------------------------------------------------------------------ DNS

def test_extracts_dns_query():
    assert extract_dns_query(dns_query("www.example.com")) == "www.example.com"


def test_ignores_dns_response():
    """QR bit set means a response — upstream only reads queries."""
    query = bytearray(dns_query("a.b.com"))
    query[2] |= 0x80
    assert extract_dns_query(bytes(query)) is None


def test_ignores_zero_question_count():
    query = bytearray(dns_query("a.b.com"))
    query[4:6] = b"\x00\x00"
    assert extract_dns_query(bytes(query)) is None


def test_long_tunneling_style_label():
    label = "k7x2mq9v" * 7          # 56 chars, one label, base32-ish
    name = f"{label}.tunnel.example.com"
    assert extract_dns_query(dns_query(name)) == name


# ------------------------------------------------------------- classification

@pytest.mark.parametrize("host,app", [
    ("www.youtube.com", "YouTube"),
    ("i.ytimg.com", "YouTube"),
    ("www.google.com", "Google"),
    ("fonts.gstatic.com", "Google"),
    ("scontent.fbcdn.net", "Facebook"),
    ("www.instagram.com", "Instagram"),
    ("web.whatsapp.com", "WhatsApp"),
    ("api.twitter.com", "Twitter/X"),
    ("x.com", "Twitter/X"),
    ("t.co", "Twitter/X"),
    ("www.netflix.com", "Netflix"),
    ("ipv4-c001.nflxvideo.net", "Netflix"),
    ("s3.amazonaws.com", "Amazon"),
    ("d1234.cloudfront.net", "Amazon"),
    ("login.microsoftonline.com", "Microsoft"),
    ("outlook.office365.com", "Microsoft"),
    ("www.apple.com", "Apple"),
    ("web.telegram.org", "Telegram"),
    ("www.tiktok.com", "TikTok"),
    ("audio.scdn.co", "Spotify"),
    ("zoom.us", "Zoom"),
    ("gateway.discord.gg", "Discord"),
    ("raw.githubusercontent.com", "GitHub"),
    ("www.cloudflare.com", "Cloudflare"),
])
def test_classifies_known_brands(host, app):
    assert classify_hostname(host) == app


def test_ggpht_matches_google_not_youtube():
    """Upstream tests "ggpht" in the Google branch before the YouTube branch.
    Order preserved on purpose — changing it would silently reclassify traffic."""
    assert classify_hostname("yt3.ggpht.com") == "Google"


@pytest.mark.parametrize("host,app", [
    ("www.netflix.com", "Netflix"),      # "x.com" must not match netfli(x.com)
    ("www.microsoft.com", "Microsoft"),  # "t.co" must not match microsof(t.co)m
    ("text.com", "HTTPS"),               # nor (t.co) inside an unrelated domain
])
def test_dotted_needles_match_whole_labels_only(host, app):
    """The upstream substring search misclassified these as Twitter/X."""
    assert classify_hostname(host) == app


def test_unlisted_and_empty():
    assert classify_hostname("internal.corp.local") == "HTTPS"
    assert classify_hostname("") == "Unknown"
    assert classify_hostname(None) == "Unknown"


def test_case_and_trailing_dot_insensitive():
    assert classify_hostname("WWW.YouTube.COM") == "YouTube"
    assert classify_hostname("www.youtube.com.") == "YouTube"


# ------------------------------------------------------------------ inspect

def test_inspect_prefers_tls_then_http_then_dns():
    assert inspect(client_hello(b"www.tiktok.com"), 4444, 443) == {
        "sni": "www.tiktok.com", "l7_app": "TikTok", "l7_proto": "TLS"}

    http = inspect(b"GET / HTTP/1.1\r\nHost: zoom.us\r\n\r\n", 5555, 80)
    assert http == {"hostname": "zoom.us", "l7_app": "Zoom", "l7_proto": "HTTP"}

    dns = inspect(dns_query("www.google.com"), 40000, 53)
    assert dns == {"dns_query": "www.google.com", "l7_app": "DNS", "l7_proto": "DNS"}


def test_inspect_unlisted_http_is_not_labelled_https():
    assert inspect(b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n", 1, 80)["l7_app"] == "HTTP"


def test_inspect_empty_and_unidentifiable():
    assert inspect(b"", None, None) == {}
    assert inspect(b"\x00" * 64, 12345, 9999) == {}


def test_dns_only_parsed_on_port_53():
    """Port-gated, as upstream does — random binary must not become a hostname."""
    assert inspect(dns_query("a.b.com"), 1234, 5678) == {}


# ------------------------------------------- against the shipped captures

@pytest.mark.skipif(not (DROP / "test_dpi.pcap").exists(),
                    reason="Packet_analyzer drop not present")
def test_matches_shipped_capture():
    """Their README documents what test_dpi.pcap contains; reproduce it."""
    from dpi.pcap_flows import extract_flows

    flows = extract_flows(str(DROP / "test_dpi.pcap"))
    apps = {f["metadata"]["l7_app"] for f in flows}

    assert {"YouTube", "Facebook", "Google", "GitHub"} <= apps
    # 16 TLS + 2 HTTP + 4 DNS identified out of 27 flows.
    assert sum(1 for f in flows if f["metadata"]["l7_app"] != "Unknown") == 22
    # Every DNS flow must carry a measured name, not a default.
    for flow in flows:
        if flow["application"] == "DNS":
            assert flow["metadata"]["dns_query"]
            assert flow["metadata"]["avg_query_length"] > 0


@pytest.mark.skipif(not (DROP / "output.pcap").exists(),
                    reason="Packet_analyzer drop not present")
def test_blocked_apps_absent_from_their_output_capture():
    """output.pcap is their engine's post-blocking result, so the apps it
    dropped must not appear — an independent cross-check of the parser."""
    from dpi.pcap_flows import extract_flows

    apps = {f["metadata"]["l7_app"] for f in extract_flows(str(DROP / "output.pcap"))}

    assert "YouTube" not in apps
    assert "Facebook" not in apps
    assert {"Google", "GitHub", "Netflix"} <= apps
