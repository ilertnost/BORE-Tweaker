#!/system/bin/sh
# Apply one BORE profile. Usage: apply.sh [profile]
#
# Sources profiles/<profile>.sh (a list of key=value lines) and writes each
# value. service.sh calls this at boot, and the GUI calls the same script, so
# there is one code path instead of three.
#
# Writing prefers the sysctl at /proc/sys/kernel/. v1.2 exposes every BORE knob
# there, min_base_slice_ns included, and falls back to the debugfs file of the
# same name for kernels that only have the debugfs path. base_slice_ns is
# read-only and is never written here.
MODPATH="${0%/*}"
CONF_DIR="/data/adb/BORE-Tweaker"

PROFILE="$1"
[ -z "$PROFILE" ] && PROFILE=$(cat "$CONF_DIR/profile" 2>/dev/null)
[ -z "$PROFILE" ] && PROFILE=stock

SRC="$MODPATH/profiles/$PROFILE.sh"
if [ ! -f "$SRC" ]; then
    echo "[BORE-Tweaker] profile '$PROFILE' not found, using stock"
    PROFILE=stock
    SRC="$MODPATH/profiles/stock.sh"
fi

. "$SRC"

write() {
    key="$1"; val="$2"
    [ -z "$val" ] && return 0
    echo "$val" > "/proc/sys/kernel/$key" 2>/dev/null && return 0
    echo "$val" > "/sys/kernel/debug/sched/$key" 2>/dev/null && return 0
    echo "[BORE-Tweaker] could not write $key (missing or not permitted)"
    return 1
}

for key in sched_bore sched_burst_exclude_kthreads sched_burst_smoothness_long \
           sched_burst_smoothness_short sched_burst_fork_atavistic \
           sched_burst_parity_threshold sched_burst_penalty_offset \
           sched_burst_penalty_scale sched_burst_cache_stop_count \
           sched_burst_cache_lifetime min_base_slice_ns; do
    eval "val=\$$key"
    write "$key" "$val"
done

echo "[BORE-Tweaker] applied profile: $PROFILE"
