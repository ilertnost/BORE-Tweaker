# Battery: softer demotion and a longer burst cache, and the only profile that
# raises the minimum slice. 8000000 ns is two ticks of 4 ms: a task holds the
# CPU longer, so there are fewer preemptions, at the cost of latency.
#
# Not measured. A starting point, not a claim.
sched_bore=1
sched_burst_exclude_kthreads=1
sched_burst_smoothness_long=1
sched_burst_smoothness_short=1
sched_burst_fork_atavistic=1
sched_burst_parity_threshold=3
sched_burst_penalty_offset=32
sched_burst_penalty_scale=960
sched_burst_cache_stop_count=96
sched_burst_cache_lifetime=120000000
min_base_slice_ns=8000000
