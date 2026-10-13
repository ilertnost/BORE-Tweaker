#!/system/bin/sh
# Build a flashable Magisk/KernelSU module zip from this directory.
#
# Run it from anywhere:  sh build.sh
# Output lands next to this script as BORE-Tweaker_<version>.zip, with the module
# files at the root of the archive (module.prop, META-INF/, ...). A zip that
# wraps everything in a folder — which is what GitHub's "Download ZIP" gives you —
# is not installable, which is what this script exists to avoid.
set -e

cd "$(dirname "$0")"

VER=$(grep '^version=' module.prop | cut -d= -f2)
OUT="BORE-Tweaker_${VER}.zip"

rm -f "$OUT"

# The exact set that ships in the module. build.sh, .gitignore, .git and the
# generated zip itself are deliberately absent.
zip -r9 -q "$OUT" \
    META-INF \
    module.prop \
    customize.sh \
    service.sh \
    action.sh \
    apply.sh \
    profiles \
    webroot \
    icon.png \
    README.md

echo "built $OUT"
# Missing module.prop at the archive root means the manager will refuse it.
unzip -l "$OUT" | grep -q ' module.prop$' || { echo "module.prop not at root!"; exit 1; }
sha256sum "$OUT"
