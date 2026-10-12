# BORE Tweaker

A Magisk/KernelSU module that tunes the **BORE** CPU scheduler (Burst-Oriented
Response Enhancer) on the APEX-Foundry kernel, through a WebUI.

## What it does

Applies a BORE profile at every boot, and lets you change any single knob
live from the module GUI. Nothing is patched in the kernel image — the module
only writes the sysctl/debugfs values the kernel already exposes.

## The knobs

These are the BORE parameters as they exist in `kernel/sched/bore.c` of the
kernel this module is for:

| knob | default | range enforced here |
|---|---|---|
| `sched_bore` | 1 | 0/1 |
| `sched_burst_exclude_kthreads` | 1 | 0/1 |
| `sched_burst_smoothness_long` | 1 | 0/1 |
| `sched_burst_smoothness_short` | 0 | 0/1 |
| `sched_burst_fork_atavistic` | 2 | 0..3 |
| `sched_burst_parity_threshold` | 2 | 1..4 |
| `sched_burst_penalty_offset` | 24 | 0..64 |
| `sched_burst_penalty_scale` | 1280 | 256..4096 |
| `sched_burst_cache_stop_count` | 64 | 8..256 |
| `sched_burst_cache_lifetime` | 75000000 (75 ms) | 15..250 ms |
| `min_base_slice_ns` | 2000000 (2 ms) | 0.5..8 ms |

Ten of them live in `/proc/sys/kernel/`, and `min_base_slice_ns` lives in
`/sys/kernel/debug/sched/` (debugfs, root only). `base_slice_ns` next to it is
read-only in the kernel and is deliberately not offered.

## Where the values are stored

The active profile name is in `/data/adb/BORE-Tweaker/profile`. The module's
`service.sh` sources `profiles/<name>.sh` on every boot. The GUI writes that
file, so what you pick survives reboots without the app needing to run.

## Safety

`min_base_slice_ns` is the minimum time a task keeps the CPU. Set it too low
and the system thrashes; too high and interactive tasks wait. The GUI clamps
it to 0.5–8 ms for that reason. If a profile makes the device feel wrong,
"Restore defaults" writes the kernel's own values back.

The profile files are plain assignments, so they can also be edited by hand
in a terminal.

## Install

Flash in Magisk or KernelSU, then use the module's action button to open the
GUI.

## Status

The module side is complete. The GUI is functional. **The profiles themselves
are not measured yet** — the values other than "stock" are reasoned starting
points, and are labelled as such in their files. If you change a profile,
re-run a benchmark before claiming an improvement.

## Thanks

- LineageOS, for `android_kernel_qcom_sm8750`, the base this kernel builds on
- AnyKernel3 by osm0sis
- MeowDump's Integrity-Box, which is where the module + WebUI layout here
  comes from
