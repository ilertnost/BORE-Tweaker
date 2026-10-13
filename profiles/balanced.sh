# Balanced: stock, with one knob moved - the burst cache is remembered a little
# longer, so a task that slept briefly keeps its interactivity credit instead of
# being treated as a fresh burst. Everything else, including the minimum slice,
# stays at the stock value.
#
# The slice cannot go below 4 ms at all, so unlike the old version of this file
# there is nothing to lower here.
#
# Not measured. A starting point, not a claim.
sched_bore=1
sched_burst_exclude_kthreads=1
sched_burst_smoothness_long=1
sched_burst_smoothness_short=0
sched_burst_fork_atavistic=2
sched_burst_parity_threshold=2
sched_burst_penalty_offset=24
sched_burst_penalty_scale=1280
sched_burst_cache_stop_count=64
sched_burst_cache_lifetime=100000000
min_base_slice_ns=4000000
