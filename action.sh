#!/system/bin/sh
# KernelSU runs action.sh when the module action button is pressed.
# Magisk opens webroot/ directly for modules that ship one, so this script
# is only needed on KernelSU. It prints the current state so the terminal
# output is useful even when the WebUI is unavailable.
MODPATH="${0%/*}"
CONF_DIR="/data/adb/BORE-Tweaker"
ACTIVE=$(cat "$CONF_DIR/profile" 2>/dev/null)
[ -z "$ACTIVE" ] && ACTIVE="stock"
echo "BORE Tweaker - active profile: $ACTIVE"
echo "Parameters:"
for f in sched_bore sched_burst_exclude_kthreads sched_burst_smoothness_long \
	 sched_burst_smoothness_short sched_burst_fork_atavistic \
	 sched_burst_parity_threshold sched_burst_penalty_offset \
	 sched_burst_penalty_scale sched_burst_cache_stop_count \
	 sched_burst_cache_lifetime min_base_slice_ns; do
	v=$(cat "/proc/sys/kernel/$f" 2>/dev/null) || v=$(cat "/sys/kernel/debug/sched/$f" 2>/dev/null)
	echo "  $f = ${v:-unavailable}"
done
