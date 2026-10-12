# Battery: keep interactivity, drop the penalty aggressiveness so the
# burst cache survives longer and fewer tasks get demoted.
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
min_base_slice_ns=3000000
