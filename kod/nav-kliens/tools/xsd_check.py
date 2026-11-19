"""Validate XML files against NAV's official Online Számla 3.0 XSDs (developer tool, not used at runtime).

Usage:
  python tools/xsd_check.py <xsd_dir> <file.xml> [<file.xml> ...]

<xsd_dir> must contain invoiceApi.xsd, invoiceData.xsd, invoiceBase.xsd (github.com/nav-gov-hu/Online-Invoice,
src/schemas/nav/gov/hu/OSA) and common.xsd (github.com/nav-gov-hu/Common, branch release/common-1.0.x,
schemas/src/main/resources/xsd/hu/gov/nav/schemas/NTCA/1.0/common/common.xsd; the older RC3 tag lacks ResponsePageType).
The official files import each other by namespace only; this script makes patched copies with
schemaLocation next to them (in a temp dir) and validates each file by its root element:
InvoiceData -> invoiceData.xsd, anything else -> invoiceApi.xsd. Needs lxml.
"""
import os
import re
import shutil
import sys
import tempfile

from lxml import etree

LOCATIONS = {
    "http://schemas.nav.gov.hu/NTCA/1.0/common": "common.xsd",
    "http://schemas.nav.gov.hu/OSA/3.0/base": "invoiceBase.xsd",
    "http://schemas.nav.gov.hu/OSA/3.0/data": "invoiceData.xsd",
}


def patched_dir(src: str) -> str:
    out = tempfile.mkdtemp(prefix="navxsd_")
    for name in ("invoiceApi.xsd", "invoiceData.xsd", "invoiceBase.xsd", "common.xsd"):
        with open(os.path.join(src, name), encoding="utf-8") as f:
            text = f.read()

        def fix(m: "re.Match[str]") -> str:
            ns = m.group(1)
            loc = LOCATIONS.get(ns)
            return f'<xs:import namespace="{ns}" schemaLocation="{loc}"/>' if loc else m.group(0)

        text = re.sub(r'<xs:import namespace="([^"]+)"\s*/>', fix, text)
        with open(os.path.join(out, name), "w", encoding="utf-8") as f:
            f.write(text)
    return out


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    d = patched_dir(sys.argv[1])
    try:
        schemas = {
            "data": etree.XMLSchema(etree.parse(os.path.join(d, "invoiceData.xsd"))),
            "api": etree.XMLSchema(etree.parse(os.path.join(d, "invoiceApi.xsd"))),
            "common": etree.XMLSchema(etree.parse(os.path.join(d, "common.xsd"))),
        }
        bad = 0
        for path in sys.argv[2:]:
            doc = etree.parse(path, etree.XMLParser(resolve_entities=False, no_network=True))
            local = etree.QName(doc.getroot()).localname
            kind = "data" if local == "InvoiceData" else "common" if local == "GeneralExceptionResponse" else "api"
            s = schemas[kind]
            if s.validate(doc):
                print(f"OK   {kind:6} {os.path.basename(path)}")
            else:
                bad += 1
                print(f"FAIL {kind:6} {os.path.basename(path)}")
                for e in list(s.error_log)[:8]:
                    print(f"     line {e.line}: {e.message}")
        return 1 if bad else 0
    finally:
        shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
