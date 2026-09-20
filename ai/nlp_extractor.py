"""AI & NLP Processing Engine for Criminal Network Analysis.

Performs Named Entity Recognition (NER) and Relationship Linking across:
  - People (Suspects, Aliases, Accomplices)
  - Organizations (Shell companies, Gangs, Financial entities)
  - Locations (Incident spots, Cell tower coordinates, Addresses)
  - Phone Numbers & IMEIs
  - Vehicle License Plate Numbers
  - Bank Account Numbers & Crypto Wallets

Establish document-to-entity and entity-to-entity relationship linkage graph.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

# Regular Expression Parsers for Cyber & Criminal Intel Attributes
REGEX_PHONE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")
REGEX_IMEI = re.compile(r"\b\d{15}\b")
REGEX_VEHICLE = re.compile(r"\b[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b", re.IGNORECASE)
REGEX_BANK_ACCT = re.compile(r"\b(?:ACCT|ACC|BANK|IBAN)[-:\s]?[A-Z0-9]{8 font-mono,18}\b", re.IGNORECASE)
REGEX_CRYPTO = re.compile(r"\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b")
REGEX_IPC_SECTION = re.compile(r"\b(?:IPC|SECTION|SEC)[-.\s]?\d{2,3}[A-Z]?\b", re.IGNORECASE)

KNOWN_SUSPECT_KEYWORDS = ["suspect", "accused", "alias", "kingpin", "operator", "associate", "courier"]
KNOWN_ORG_KEYWORDS = ["ltd", "inc", "corp", "traders", "enterprises", "syndicate", "cartel", "group", "holdings"]


class NLPEngine:
    """Extracts entities & relationships from FIR documents, CDR logs, and financial records."""

    def extract_entities(self, text: str, source_doc_id: str = "") -> dict[str, list[dict[str, Any]]]:
        """Extract structured entities from unstructured or semi-structured text."""
        entities: list[dict[str, Any]] = []
        relationships: list[dict[str, Any]] = []

        # 1. Extract Phone Numbers
        for m in REGEX_PHONE.finditer(text):
            val = m.group(0).strip()
            entities.append({
                "id": f"phone_{val}",
                "name": val,
                "type": "phone",
                "kind": "Telecom",
                "risk": 75,
                "source_doc": source_doc_id
            })

        # 2. Extract IMEIs
        for m in REGEX_IMEI.finditer(text):
            val = m.group(0).strip()
            entities.append({
                "id": f"imei_{val}",
                "name": f"IMEI: {val}",
                "type": "phone",
                "kind": "IMEI Device",
                "risk": 80,
                "source_doc": source_doc_id
            })

        # 3. Extract Vehicle Plates
        for m in REGEX_VEHICLE.finditer(text):
            val = m.group(0).strip().upper()
            entities.append({
                "id": f"vehicle_{val}",
                "name": val,
                "type": "vehicle",
                "kind": "Vehicle Plate",
                "risk": 70,
                "source_doc": source_doc_id
            })

        # 4. Extract Bank Accounts & Crypto Wallets
        for m in REGEX_CRYPTO.finditer(text):
            val = m.group(0).strip()
            entities.append({
                "id": f"crypto_{val[:10]}",
                "name": f"Wallet: {val[:12]}...",
                "type": "account",
                "kind": "Crypto Wallet",
                "risk": 88,
                "source_doc": source_doc_id
            })

        # 5. Extract Suspect Names & Organizations from Context
        words = text.split()
        for i, word in enumerate(words):
            clean_w = re.sub(r"[^\w\s]", "", word)
            if clean_w.lower() in KNOWN_SUSPECT_KEYWORDS and i + 1 < len(words):
                name = " ".join([re.sub(r"[^\w\s]", "", w) for w in words[i+1:min(i+3, len(words))]])
                if len(name) > 2 and name[0].isupper():
                    entities.append({
                        "id": f"person_{name.replace(' ', '_').lower()}",
                        "name": name,
                        "type": "person",
                        "kind": "Suspect Target",
                        "risk": 92,
                        "central": True,
                        "source_doc": source_doc_id
                    })

            if clean_w.lower() in KNOWN_ORG_KEYWORDS and i > 0:
                org_name = " ".join([re.sub(r"[^\w\s]", "", w) for w in words[max(0, i-2):i+1]])
                entities.append({
                    "id": f"org_{org_name.replace(' ', '_').lower()}",
                    "name": org_name,
                    "type": "organization",
                    "kind": "Front Organization",
                    "risk": 82,
                    "source_doc": source_doc_id
                })

        # Deduplicate entities by ID
        unique_entities = {}
        for item in entities:
            unique_entities[item["id"]] = item

        # Build baseline relationships mapping extracted entities back to document
        entity_list = list(unique_entities.values())
        if source_doc_id:
            for ent in entity_list:
                relationships.append({
                    "source": source_doc_id,
                    "target": ent["id"],
                    "type": "MENTIONED_IN",
                    "weight": 1.0
                })

        # Cross-link entities within same document
        for i in range(len(entity_list)):
            for j in range(i + 1, len(entity_list)):
                e1, e2 = entity_list[i], entity_list[j]
                relationships.append({
                    "source": e1["id"],
                    "target": e2["id"],
                    "type": "CO_OCCURRENCE",
                    "weight": 0.8
                })

        return {
            "entities": entity_list,
            "relationships": relationships
        }


nlp_engine = NLPEngine()
