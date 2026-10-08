#!/usr/bin/env python3
"""Install the two offline Argos Translate models used by Get Mchongo."""
import sys
import types

# Argos treats Stanza as an optional sentence splitter in this app; the local runtime
# uses its own simple splitter so model installation does not need Stanza or PyTorch.
sys.modules.setdefault("stanza", types.ModuleType("stanza"))
import argostranslate.settings

argostranslate.settings.device = "cpu"
argostranslate.settings.chunk_type = argostranslate.settings.ChunkType.MINISBD
import argostranslate.package

argostranslate.package.update_package_index()
packages = argostranslate.package.get_available_packages()
for source, target in (("en", "sw"), ("sw", "en")):
    package = next((item for item in packages if item.from_code == source and item.to_code == target), None)
    if package is None:
        raise SystemExit(f"No Argos Translate package is available for {source}→{target}.")
    print(f"Installing offline translation package {source}→{target} ({package.package_version})", flush=True)
    argostranslate.package.install_from_path(package.download())
print("Offline English↔Kiswahili translation models are ready.", flush=True)
