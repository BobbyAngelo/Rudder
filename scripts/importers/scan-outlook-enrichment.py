#!/usr/bin/env python3
"""
Outlook OLM Email Scanner → People Enrichment
Scans 14,361 emails and extracts sender info to enrich rudder.db contacts.
"""
import zipfile, xml.etree.ElementTree as ET, sqlite3, re, json, sys
from collections import defaultdict

OLM_PATH = "/Volumes/RUDDER 20/00_SYSTEM_BACKUPS/Outlook_Archive_Mac.olm"
DB_PATH = "/Users/sovereign/Developer/Rudder/data/rudder.db"

# Build lookup from existing contacts
db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row
contacts = db.execute("SELECT id, name, email, phone, notes FROM people").fetchall()

# Build phone → contact_id and email → contact_id maps
phone_map = {}
email_map = {}
name_map = {}
for c in contacts:
    if c['phone']:
        clean = re.sub(r'[^\d]', '', c['phone'])
        if len(clean) >= 10:
            phone_map[clean[-10:]] = c['id']
    if c['email']:
        email_map[c['email'].lower()] = c['id']
    # Name map: lowercase full name and first name
    nm = c['name'].lower().strip()
    name_map[nm] = c['id']

print(f"Loaded {len(contacts)} contacts, {len(phone_map)} phones, {len(email_map)} emails")

# Scan OLM
enrichment = defaultdict(lambda: {"emails_from": [], "emails_to": [], "subjects": [], "sender_email": None, "sender_name": None})
all_senders = defaultdict(int)  # email → count

count = 0
errors = 0

with zipfile.ZipFile(OLM_PATH, 'r') as z:
    xml_files = [f for f in z.namelist() if f.endswith('.xml')]
    total = len(xml_files)
    print(f"Scanning {total} email XMLs...")
    
    for i, fname in enumerate(xml_files):
        if i % 2000 == 0:
            print(f"  {i}/{total}...")
        try:
            data = z.read(fname).decode('utf-8', errors='replace')
            # Extract key fields using regex (faster than XML parsing for messy data)
            
            sender_match = re.search(r'OPFMessageCopySenderAddress[^>]*>([^<]+)', data)
            sender_name_match = re.search(r'OPFMessageCopySenderName[^>]*>([^<]+)', data)
            subject_match = re.search(r'OPFMessageCopySubject[^>]*>([^<]+)', data)
            to_match = re.search(r'OPFMessageCopyToAddresses[^>]*>([^<]+)', data)
            body_match = re.search(r'OPFMessageCopyBody[^>]*>(.{0,500})', data, re.DOTALL)
            
            sender_email = sender_match.group(1).strip().lower() if sender_match else None
            sender_name = sender_name_match.group(1).strip() if sender_name_match else None
            subject = subject_match.group(1).strip() if subject_match else ""
            body_preview = body_match.group(1).strip()[:200] if body_match else ""
            
            if sender_email and sender_email != 'robert_angelo@hotmail.com':
                all_senders[sender_email] += 1
                
                # Try to match to existing contact by email
                cid = email_map.get(sender_email)
                if cid:
                    enrichment[cid]["subjects"].append(subject)
                    enrichment[cid]["sender_email"] = sender_email
                    enrichment[cid]["sender_name"] = sender_name
                else:
                    # Try matching by name
                    if sender_name:
                        nm = sender_name.lower().strip()
                        cid = name_map.get(nm)
                        if cid:
                            enrichment[cid]["subjects"].append(subject)
                            enrichment[cid]["sender_email"] = sender_email
                            enrichment[cid]["sender_name"] = sender_name
            
            count += 1
        except Exception as e:
            errors += 1

print(f"\nScanned {count} emails ({errors} errors)")
print(f"Unique non-Robert senders: {len(all_senders)}")
print(f"Contacts matched: {len(enrichment)}")

# Update contacts with enrichment data
updated = 0
for cid, info in enrichment.items():
    subjects = list(set(info["subjects"]))[:10]  # Top 10 unique subjects
    subject_str = "; ".join(s for s in subjects if s)[:500]
    
    # Build enrichment note
    current = db.execute("SELECT name, email, notes FROM people WHERE id=?", (cid,)).fetchone()
    if not current:
        continue
    
    parts = []
    if current['notes']:
        parts.append(current['notes'])
    
    if info["sender_email"] and not current['email']:
        # Update email if missing
        db.execute("UPDATE people SET email=? WHERE id=? AND email IS NULL", (info["sender_email"], cid))
    
    if subject_str:
        parts.append(f"Outlook emails: {subject_str}")
    
    new_notes = " | ".join(parts)
    db.execute("UPDATE people SET notes=? WHERE id=?", (new_notes[:1000], cid))
    updated += 1

# Also find top senders not in our contacts
print(f"\nUpdated {updated} contacts with email context")
print(f"\n=== Top 30 unknown senders (not in contacts) ===")
known_emails = set(email_map.keys())
unknown = [(e, c) for e, c in all_senders.items() if e not in known_emails and '@' in e]
unknown.sort(key=lambda x: -x[1])
for email, cnt in unknown[:30]:
    print(f"  {cnt:>3}x  {email}")

db.commit()
db.close()
print("\nDone!")
