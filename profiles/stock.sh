# Stock APEX-Foundry BORE defaults.
#
# The ten burst knobs are exactly what kernel/sched/bore.c ships with. The last
# one needs a note: the kernel's CONFIG_MIN_BASE_SLICE_NS is 2000000, but BORE
# rounds the request up to a whole tick, and a tick is 4 ms at HZ=250, so the
# slice is 4 ms either way. This file states 4000000 to name the value the
# scheduler actually uses; base_slice_ns in the GUI confirms it.
sched_bore=1
sched_burst_exclude_kthreads=1
sched_burst_smoothness_long=1
sched_burst_smoothness_short=0
sched_burst_fork_atavistic=2
sched_burst_parity_threshold=2
sched_burst_penalty_offset=24
sched_burst_penalty_scale=1280
sched_burst_cache_stop_count=64
sched_burst_cache_lifetime=75000000
min_base_slice_ns=4000000
