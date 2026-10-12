#!/system/bin/sh
# Apply the chosen BORE profile at every boot.
#
# The active profile name is stored by the GUI in
# /data/adb/BORE-Tweaker/profile; anything that is not an existing file in
# $MODPATH/profiles falls back to stock.
MODPATH="${0%/*}"
CONF_DIR="/data/adb/BORE-Tweaker"
PROFILE_FILE="$CONF_DIR/profile"

log() { echo "[BORE-Tweaker] $*"; }

ACTIVE=$(cat "$PROFILE_FILE" 2>/dev/null)
[ -z "$ACTIVE" ] && ACTIVE="stock"

SRC="$MODPATH/profiles/$ACTIVE.sh"
if [ ! -f "$SRC" ]; then
    log "profile '$ACTIVE' not found, using stock"
    ACTIVE="stock"
    SRC="$MODPATH/profiles/stock.sh"
fi

log "applying profile: $ACTIVE"
. "$SRC"

apply() {
    key="$1"; val="$2"
    [ -z "$val" ] && return 0
    echo "$val" > "/proc/sys/kernel/$key" 2>/dev/null && return 0
    echo "$val" > "/sys/kernel/debug/sched/${key}" 2>/dev/null && return 0
    log "could not write $key (missing or not permitted)"
}

for key in sched_bore sched_burst_exclude_kthreads sched_burst_smoothness_long \
           sched_burst_smoothness_short sched_burst_fork_atavistic \
           sched_burst_parity_threshold sched_burst_penalty_offset \
           sched_burst_penalty_scale sched_burst_cache_stop_count \
           sched_burst_cache_lifetime min_base_slice_ns; do
    eval "val=\$$key"
    apply "$key" "$val"
done

log "done"
