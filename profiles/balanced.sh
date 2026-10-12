# Balanced: stock defaults with a slightly longer minimum slice, which is
# the knob that most noticeably cuts jank under load without costing
# battery the way the performance profile does.
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
min_base_slice_ns=2500000
