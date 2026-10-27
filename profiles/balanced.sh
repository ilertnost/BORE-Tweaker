# Balanced: stock with the two knobs that matter on a phone moved a little.
# The baseline penalty is a touch softer (22 vs 24), it grows a little faster
# once a task really is busy (1472 vs 1280), so short bursts are treated gently
# and long ones are demoted sooner. The burst cache lasts 96 ms instead of
# 75 ms, so a task that slept briefly keeps its interactivity credit instead of
# starting over.
#
# Sits between stock and performance, without performance's hard demotion.
#
# Not measured. A starting point, not a claim.
sched_bore=1
sched_burst_exclude_kthreads=1
sched_burst_smoothness_long=1
sched_burst_smoothness_short=0
sched_burst_fork_atavistic=2
sched_burst_parity_threshold=2
sched_burst_penalty_offset=22
sched_burst_penalty_scale=1472
sched_burst_cache_stop_count=56
sched_burst_cache_lifetime=96000000
min_base_slice_ns=4000000
