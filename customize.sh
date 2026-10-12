#!/system/bin/sh
# Runs on first install only. Make sure the config dir exists so the GUI
# has somewhere to write its profile selection.
CONF_DIR="/data/adb/BORE-Tweaker"
[ -d "$CONF_DIR" ] || mkdir -p "$CONF_DIR"
# Default to the stock profile until the user picks one.
[ -f "$CONF_DIR/profile" ] || echo "stock" > "$CONF_DIR/profile"
