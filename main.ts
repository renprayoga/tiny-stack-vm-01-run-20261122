// Tiny stack VM: a faithful interpreter of make.fun's tiny stack ISA v1.
// For each /input/<id>/ it runs program.bin on input.bin and writes
// /output/<id>/stdout.bin + exit.txt, following the reference VM
// (kit generator/subject/vm.mjs): check order, every trap code, step/output
// limits, exact 32-bit wrap semantics. Typed-array state, one tight loop.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Per-opcode [immediate bytes, popped, pushed]; -1 immediate = no such opcode.
const IMM = new Int8Array(256).fill(-1);
const POPS = new Uint8Array(256);
const PUSHES = new Uint8Array(256);
const set = (op: number, imm: number, po: number, pu: number) => {
  IMM[op] = imm; POPS[op] = po; PUSHES[op] = pu;
};
set(0, 0, 0, 0); set(1, 1, 0, 1); set(2, 4, 0, 1); set(3, 0, 1, 0);
set(4, 0, 1, 2); set(5, 0, 2, 2); set(6, 0, 2, 3); set(7, 0, 3, 3);
for (let o = 16; o <= 34; o++) if (o !== 23 && o !== 27 && o !== 31) set(o, 0, 2, 1);
set(23, 0, 1, 1); set(27, 0, 1, 1); // NEG, NOT
set(48, 2, 0, 0); set(49, 2, 1, 0); set(50, 2, 1, 0); set(51, 2, 0, 0);
set(52, 0, 0, 0); set(64, 0, 1, 1); set(65, 0, 2, 0); set(80, 0, 1, 0);
set(81, 0, 1, 0); set(82, 0, 0, 1); set(83, 0, 1, 0);

function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length;
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let cp = 0;
  const M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, steps = 0, code = 0;
  outer: for (;;) {
    if (steps === 1000000) { code = 10; break; }
    if (pc < 0 || pc >= n) { code = 9; break; }
    const op = p[pc];
    const imm = IMM[op];
    if (imm < 0) { code = 5; break; }
    if (pc + imm >= n) { code = 9; break; }
    steps++;
    const nx = pc + 1 + imm;
    const po = POPS[op], pu = PUSHES[op];
    if (sp < po) { code = 2; break; }
    if (sp - po + pu > 256) { code = 3; break; }
    pc = nx;
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27) { // two-operand ops
      const b = D[sp - 1], a = D[sp - 2];
      let r = 0;
      if (op === 16) r = (a + b) | 0;
      else if (op === 17) r = (a - b) | 0;
      else if (op === 18) r = Math.imul(a, b);
      else if (op === 19) {
        if (b === 0) { code = 4; break outer; }
        r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
      } else if (op === 20) {
        if (b === 0) { code = 4; break outer; }
        r = b === -1 ? 0 : (a % b) | 0;
      } else if (op === 21) {
        if (b === 0) { code = 4; break outer; }
        r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
      } else if (op === 22) {
        if (b === 0) { code = 4; break outer; }
        r = ((a >>> 0) % (b >>> 0)) | 0;
      } else if (op === 24) r = a & b;
      else if (op === 25) r = a | b;
      else if (op === 26) r = a ^ b;
      else if (op === 28) r = a << (b & 31);
      else if (op === 29) r = a >> (b & 31);
      else if (op === 30) r = (a >>> (b & 31)) | 0;
      else if (op === 32) r = a === b ? 1 : 0;
      else if (op === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      sp -= 2;
      D[sp++] = r;
      continue;
    }
    switch (op) {
      case 0: code = 0; break outer;
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        if (op === 48) pc = nx + rel;
        else { const v = D[--sp]; if ((op === 49) === (v === 0)) pc = nx + rel; }
        break;
      }
      case 51:
        if (cp === 64) { code = 7; break outer; }
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52:
        if (cp === 0) { code = 8; break outer; }
        pc = C[--cp];
        break;
      case 64: {
        const a = D[sp - 1];
        if (a < 0 || a >= 256) { code = 6; break outer; }
        D[sp - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[sp - 1];
        if (a < 0 || a >= 256) { code = 6; break outer; }
        const v = D[sp - 2];
        sp -= 2;
        M[a] = v;
        break;
      }
      case 80: { // PRINT: decimal ASCII, no newline; limit checked before writing
        const s = String(D[sp - 1]);
        if (ol + s.length > 65536) { code = 11; break outer; }
        sp--;
        for (let i = 0; i < s.length; i++) out[ol++] = s.charCodeAt(i);
        break;
      }
      case 81:
        if (ol + 1 > 65536) { code = 11; break outer; }
        out[ol++] = D[--sp] & 255;
        break;
      case 82:
        D[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 83:
        code = D[--sp] & 255;
        break outer;
      default: code = 5; break outer;
    }
  }
  return { out: out.subarray(0, ol), code };
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const dir = join(I, id);
  if (!statSync(dir).isDirectory()) continue;
  const r = run(readFileSync(join(dir, 'program.bin')), readFileSync(join(dir, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
