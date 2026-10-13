# Performance: hard demotion and a short burst cache, for when the foreground
# must win. The minimum slice is deliberately left at the 4 ms floor - it cannot
# be lowered, so there is nothing to set here.
#
# Not measured. A starting point, not a claim.
sched_bore=1
sched_burst_exclude_kthreads=1
sched_burst_smoothness_long=1
sched_burst_smoothness_short=0
sched_burst_fork_atavistic=0
sched_burst_parity_threshold=1
sched_burst_penalty_offset=16
sched_burst_penalty_scale=1920
sched_burst_cache_stop_count=32
sched_burst_cache_lifetime=50000000
min_base_slice_ns=4000000
