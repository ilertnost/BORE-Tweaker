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
| `min_base_slice_ns` | 2000000 (2 ms) | 4..16 ms, whole ticks |

On v1.2 of the kernel every one of them is a writable sysctl under
`/proc/sys/kernel/`. `min_base_slice_ns` used to exist only in debugfs
(`/sys/kernel/debug/sched/`), which stock Android does not mount, so the module
could not reach it at all. v1.2 adds it — and the read-only `base_slice_ns` — to
the BORE sysctls. The write path here still falls back to the debugfs file of the
same name, so the module works on older kernels too.

### min_base_slice_ns is quantised, and this module says so

BORE does not use `min_base_slice_ns` directly. It rounds it up to a whole tick:

    sysctl_sched_base_slice = nsecs_per_tick *
        max(1, DIV_ROUND_UP(sysctl_sched_min_base_slice, nsecs_per_tick))

At `CONFIG_HZ=250` a tick is 4 ms, so the slice in force is always a multiple of
4 ms and cannot be less than 4 ms. 2000000 (the kernel's `CONFIG_MIN_BASE_SLICE_NS`)
and 4000000 both give a 4 ms slice. This is why the GUI offers 4, 8, 12 and
16 ms rather than a smooth range, and why it shows the value the scheduler
actually uses, read back from `base_slice_ns`.

## Where the values are stored

The active profile name is in `/data/adb/BORE-Tweaker/profile`. The module's
`service.sh` calls `apply.sh`, which sources `profiles/<name>.sh` and writes each
value. The GUI calls the same `apply.sh`, so boot and the buttons share one code
path instead of three copies. What you pick survives reboots without the app
needing to run.

## Safety

`min_base_slice_ns` is the shortest time a task may hold the CPU. Set it too
high and interactive tasks wait. The GUI only offers whole ticks between 4 and
16 ms for that reason. If a profile makes the device feel wrong, "Restore
defaults" writes the kernel's own values back.

The profile files are plain assignments, so they can also be edited by hand in a
terminal.

## Install

Download `BORE-Tweaker_v1.2.zip` from the **Releases** page and flash it in the
Magisk or KernelSU app, then restart the manager and open the module's WebUI.

Do **not** flash GitHub's "Code → Download ZIP" archive, or any other zip that
wraps the files in a `BORE-Tweaker/` folder: the manager wants `module.prop` at
the root of the archive and fails with `-1` when it is nested. To build the zip
yourself, run `sh build.sh` in this directory — it produces exactly the file
attached to the release.

The kernel is a separate download. An AnyKernel3 zip is flashed to the **boot
partition** (with a kernel flasher, or `fastboot flash boot`), never installed
from the module list: it has no `module.prop`, so a manager that tries to read it
as a module rejects it.

## Status

The module side is complete and the GUI is functional. **The profiles themselves
are not measured** — the values other than "stock" are reasoned starting points,
and are labelled as such in their files. If you change a profile, re-run a
benchmark before claiming an improvement.

## Thanks

- LineageOS, for `android_kernel_qcom_sm8750`, the base this kernel builds on
- AnyKernel3 by osm0sis
- MeowDump's Integrity-Box, which is where the module + WebUI layout here
  comes from
