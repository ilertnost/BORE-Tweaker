#!/system/bin/sh
# Apply the chosen BORE profile at every boot.
#
# The active profile name is stored by the GUI in
# /data/adb/BORE-Tweaker/profile; apply.sh falls back to stock if it names a
# file that does not exist.
MODPATH="${0%/*}"
CONF_DIR="/data/adb/BORE-Tweaker"

ACTIVE=$(cat "$CONF_DIR/profile" 2>/dev/null)
[ -z "$ACTIVE" ] && ACTIVE="stock"

echo "[BORE-Tweaker] boot: applying profile: $ACTIVE"
sh "$MODPATH/apply.sh" "$ACTIVE"
