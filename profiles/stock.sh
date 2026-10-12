# Stock HyperOS 4 / APEX-Foundry BORE defaults.
# Every value here is the one the kernel ships with, read out of
# kernel/sched/bore.c and arch/arm64/configs/gki_defconfig.
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
min_base_slice_ns=2000000
