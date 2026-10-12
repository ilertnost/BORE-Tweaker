# Performance: aggressive burst penalty and a short minimum slice, so
# background tasks are demoted hard and the foreground gets the CPU.
# This costs battery and measurably raises thermals -- it is the profile
# to use for benchmarks, not for daily use.
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
min_base_slice_ns=1500000
