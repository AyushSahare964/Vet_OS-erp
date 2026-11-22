"""Parse the Real Care invoice PDFs in ../bills into ../bills/parsed.json (read-only on the PDFs)."""
import glob, json, re, os, sys
import pymupdf

root = os.path.join(os.path.dirname(__file__), "..", "bills")
rs = lambda s: float(re.sub(r"[^0-9.\-]", "", s.replace("Rs.", "").replace("Rs", "")) or 0)
out = []
for f in sorted(glob.glob(os.path.join(root, "*.pdf"))):
    L = [x.strip() for x in "\n".join(p.get_text() for p in pymupdf.open(f)).split("\n") if x.strip()]
    b = {"file": os.path.basename(f)}
    i = L.index("Invoice No:")
    labels = []
    j = i
    while L[j].endswith(":"):
        labels.append(L[j]); j += 1
    vals = L[j:j + len(labels)]
    m = dict(zip(labels, vals))
    b["invoiceNo"] = m["Invoice No:"]; b["owner"] = m["Issued to:"]; b["date"] = m["Date Issued:"]
    b["nextVisit"] = m.get("Next Visit:"); b["gstin"] = m.get("GSTIN:")
    b["taxInvoice"] = "TAX INVOICE" in L
    pet = L[L.index("Pet Information:") + 1]
    p = [x.strip() for x in pet.split("|")]
    b["pet"] = {"name": p[0], "species": p[1], "breed": p[2].replace("Breed:", "").strip(), "sex": p[3].replace("Sex:", "").strip()}
    hdr_end = L.index("TOTAL", L.index("PARTICULARS"))
    has_gst = "GST %" in L[L.index("PARTICULARS"):hdr_end]
    k = hdr_end + 1; cat = ""; items = []
    end = L.index("SUBTOTAL")
    while k < end:
        if k + 2 < end and re.fullmatch(r"\d+(\.\d+)?", L[k + 1]) and L[k + 2].startswith("Rs."):
            it = {"category": cat, "name": L[k], "qty": float(L[k + 1]), "price": rs(L[k + 2])}
            k += 3
            if has_gst:
                it["gst"] = float(L[k].replace("%", "")); k += 1
            it["total"] = rs(L[k]); k += 1
            items.append(it)
        else:
            cat = L[k]; k += 1
    b["items"] = items
    tot = {}
    for key in ["SUBTOTAL", "DISCOUNT", "GST AMOUNT", "ROUND-OFF", "TOTAL AMOUNT", "AMOUNT PAID", "BALANCE DUE"]:
        if key in L[end:]:
            tot[key] = rs(L[end:][L[end:].index(key) + 1])
    b["totals"] = tot
    ci = L.index("Client Info:")
    b["phone"] = L[ci + 2] if len(L) > ci + 2 else ""
    out.append(b)
json.dump(out, open(os.path.join(root, "parsed.json"), "w"), indent=1)
for b in out:
    s = sum(i["total"] for i in b["items"])
    t = b["totals"]
    print(b["invoiceNo"], b["owner"], b["date"], "items", len(b["items"]), "lines", s, "sub", t.get("SUBTOTAL"), "disc", t.get("DISCOUNT"), "ro", t.get("ROUND-OFF"), "tot", t.get("TOTAL AMOUNT"), "paid", t.get("AMOUNT PAID"), "bal", t.get("BALANCE DUE"), "phone", b["phone"])
