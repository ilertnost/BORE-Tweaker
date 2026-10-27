# Battery: fewer preemptions and a calmer penalty curve. The minimum slice goes
# up to 8 ms (two ticks of 4 ms) so a task holds the CPU longer, the penalty
# grows more slowly than stock (1024 vs 1280), and the burst cache survives a
# sleep for 128 ms instead of 75 ms.
#
# The cost is latency: 8 ms is the one knob here that changes how the scheduler
# preempts, and it is why this profile is not the default.
#
# Not measured. A starting point, not a claim.
sched_bore=1
sched_burst_exclude_kthreads=1
sched_burst_smoothness_long=1
sched_burst_smoothness_short=1
sched_burst_fork_atavistic=1
sched_burst_parity_threshold=3
sched_burst_penalty_offset=32
sched_burst_penalty_scale=1024
sched_burst_cache_stop_count=96
sched_burst_cache_lifetime=128000000
min_base_slice_ns=8000000
