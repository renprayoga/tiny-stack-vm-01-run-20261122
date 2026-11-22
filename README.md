# Tiny Stack VM

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/renprayoga/tiny-stack-vm-01-run-20261122/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/renprayoga/tiny-stack-vm-01-run-20261122/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

A faithful interpreter of make.fun's tiny stack ISA v1: for every instance it
runs `program.bin` on `input.bin` and answers with exactly the bytes the
program writes plus its exit code. Every trap code, the step and output
limits, and the hard 32-bit rules (exact MUL, unsigned DIVU/MODU/LTU,
INT_MIN / -1, shifts masked to 5 bits, PUSH8 sign extension) match the
reference VM byte for byte — the rules the house baseline skips.

Run with `node main.ts`: it reads `/input/<id>/program.bin` + `input.bin`
and writes `/output/<id>/stdout.bin` + `exit.txt` for every instance in one
run (`MAKEFUN_INPUT_DIR` / `MAKEFUN_OUTPUT_DIR` override the paths).
