// Implementation of the MOS 6502. Constructor takes a bus proxy object, and optionally and array buffer as args
// Passing in an array buffer allows the use of a shared array buffer to view state in another thread.
export default class MOS6502 {
  constructor(bus, buffer=new ArrayBuffer(10), offset=0) {
    if(buffer.byteLength < 10 + offset) throw new Error();
    this.bus = bus;
    this._registers = new Uint8Array(buffer, 0, 5);
    this._16 = new Uint16Array(buffer, 5, 2);
    this._data = new Uint8Array(buffer, 9, 1);
    this.cycles = 0;
    this.op = null;
  }

  // getters and setters for convienience
  get data() { return this._data[0]; }
  set data(val) { this._data[0] = val; }

  get a() { return this._registers[0]; }
  set a(val) { this._registers[0] = val; }

  get x() { return this._registers[1]; }
  set x(val) { this._registers[1] = val; }

  get y() { return this._registers[2]; }
  set y(val) { this._registers[2] =  val; }

  get f() { return this._registers[3]; }
  set f(val) { this._registers[3] = val; }

  get sp() { return this._registers[4]; }
  set sp(val) { this._registers[4] = val; }

  get pc() { return this._16[0]; }
  set pc(val) { this._16[0] = val; }

  get n() { return +!!(this.f & 0x80); }
  set n(val) { this.f |= +val << 7; }

  get v() { return +!!(this.f & 0x40); }
  set v(val) { this.f |= +val << 6; }

  get b() { return +!!(this.f & 0x10); }
  set b(val) { this.f |= +val << 4; }

  get d() { return +!!(this.f & 0x08); }
  set d(val) { this.f |= +val << 3; }

  get i() { return +!!(this.f & 0x04); }
  set i(val) { this.f |= +val << 2; }

  get z() { return +!!(this.f & 0x02); }
  set z(val) { this.f |= +val << 1; }

  get c() { return +!!(this.f & 0x01); }
  set c(val) { this.f |= +val; }

  get tmp() { return this._16[1]; }
  set tmp(val) { this._16[1] = val; }

  advance = () => this.pc++;

  push = val => { this.bus[0x0100 & this.sp--] = +val };
  pop = () => +this.bus[0x0100 & ++this.sp];

  // address modes
  // implied
  IMP = () => {
    this.data = this.a;
    return 0;
  };

  // immediate
  IMM = () => {
    this.data = this.bus[this.advance()];
    return 0;
  };

  // zero page offset 
  ZPO = () => {
    this.data = this.bus[this.bus[this.advance()]];
    return 0;
  };

  // zero page offset x indexed
  ZPX = () => {
    this.data = this.bus[(this.bus[this.advance()] + this.x) & 0xFF];
    return 0;
  };

  // zero page offset y indexed
  ZPY = () => {
    this.data = this.bus[(this.bus[this.advance()] + this.y) & 0xFF];
    return 0;
  };
  
  // absolute address (little endian)
  ABS = () => {
    this.bus.address = this.bus[this.advance()] & (this.bus[this.advance()] << 8)
    this.data = this.bus.read();
    return 0;
  };

  // absolute x indexed
  ABX = () => {
    let lo = this.bus[this.advance()],
        hi = this.bus[this.advance()];
    this.bus.address = ((hi<<8) | lo) + this.x;
    this.data = this.bus[address]
    return this.bus.address & 0xFF00 == hi << 8 ? 0 : 1;
  };

  // absolute y indexed
  ABY = () => {
    let lo = this.bus[this.advance()],
        hi = this.bus[this.advance()] << 8;
    this.bus.address = (hi | lo) + this.y;
    this.data = this.bus[address]
    return this.bus.address & 0xFF00 == hi ? 0 : 1;
  };

  // indirect
  IND = () => {
    let lo = this.bus[this.advance()],
        hi = this.bus[this.advance()] << 8,
        abslo = this.bus[lo++ | hi],
        // hw bug causes overflow if low byte is 0xFF
        abshi = this.bus[(lo & 0xFF) | hi] << 8;
    this.bus.address = this.bus[abslo | abshi];
    this.data = this.bus.read();
    return 0;
  };

  // indirect zero page x offset
  IZX = () => {
    let ptr = this.bus[this.advance()],
        lo = this.bus[(ptr++ + this.x) & 0xFF],
        hi = this.bus[(ptr + this.x) & 0xFF] << 8;
    this.data = this.bus[lo | hi];
    return 0;
  };

  // indirect zero page y offset
  IZY = () => {
    let ptr = this.bus[this.advance()],
        lo = this.bus[(ptr++ + this.x) & 0xFF],
        hi = this.bus[(ptr + this.x) & 0xFF] << 8;
    this.bus.address = (lo | hi) + this.y;
    this.data = this.bus.read;
    return (this.bus.address & 0xFF00) == hi ? 0 : 1;
  };

  // relative
  REL = () => {
    let offset = this.bus[this.advance()];
    if(offset & 0x80) offset = -(~offset + 1);
    this.data = this.bus[this.pc + offset];
  };

  // instructions
  // add with carry
  ADC = () => {
    const res = this.a + this.data + this.c,
          res8 = res & 0xFF;
    this.v = ((this.a >>> 7) ^ (res8 >>> 7)) & ~((this.a >>> 7) ^ (this.data >>> 7)),
    this.n = res8 >>> 7,
    this.c = res >>> 8;
    this.a = this.res8;
    return 1;
  };

  // bitwise and
  AND = () => {
    this.a &= this.data;
    this.z = !this.a;
    this.n = !!(this.a & 0x80);
    return 1;
  };

  // arithmatic shift left
  ASL = () => {
    this.tmp = this.data << 1;
    this.z = !this.tmp;
    this.c = this.data >>> 7;
    this.n = this.tmp >>> 7;
    if(this.op?.addressmode == this.IMP) this.a = this.tmp;
    else this.bus.write(this.tmp);
    return 0;
  };

  // branch carry clear
  BCC = () => {
    if(this.c) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // branch carry set
  BCS = () => {
    if(!this.c) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // branch equal
  BEQ = () => {
    if(!this.z) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // set flags
  BIT = () => {
    this.n = this.data >>> 7;
    this.v = this.data >>> 6;
    this.z = ~(this.data & this.a);
    return 0;
  };

  // branch neg
  BMI = () => {
    if(!this.n) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // branch not equal
  BNE = () => {
    if(this.z) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // branch positive
  BPL = () => {
    if(this.n) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // break
  BRK = () => {
    this.advance();  // brk skips next instruction
    this.i = 1;
    this.push(this.pc >>> 8);
    this.push(this.pc & 0xFF);
    this.b = 1;
    this.push(this.f);
    this.b = 0;
    this.pc = this.bus[0xFFFE] | (this.bus[0xFFFF] << 8);
    return 0;
  };

  // branch overflow
  BVC = () => {
    if(!this.v) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // branch not overflow
  BVS = () => {
    if(this.v) return 0;
    this.cycles = this.bus.address & 0xFF00 == this.pc & 0xFF00 ? this.cycles + 1 : this.cycles + 2;
    this.pc = this.bus.address;
    return 0;
  };

  // clear carry
  CLC = () => {
    this.c = 0;
    return 0;
  };

  // clear decimal
  CLD = () => {
    this.d = 0;
    return 0;
  };

  // clear interupt flag
  CLI = () => {
    this.i = 0;
    return 0;
  };

  // clear overflow
  CLV = () => {
    this.v = 0;
    return 0;
  };

  // compare accumulator and set flags
  CMP = () => {
    this.tmp = (0x0100 | this.a) - this.data;
    this.c = +!!(this.tmp & 0x0100);
    this.z = this.tmp == 0x0100;
    this.n = +!!(this.tmp & 0x80);
    return 1;
  };

  // compare x
  CPX = () => {
    this.tmp = (0x0100 | this.x) - this.data;
    this.c = +!!(this.tmp & 0x0100);
    this.z = this.tmp == 0x0100;
    this.n = +!!(this.tmp & 0x80);
    return 0;
  };

  // compare y
  CPY = () => {
    this.tmp = (0x0100 | this.y) - this.data;
    this.c = +!!(this.tmp & 0x0100);
    this.z = this.tmp == 0x0100;
    this.n = +!!(this.tmp & 0x80);
    return 0;
  };

  // decrement
  DEC = () => {
    this.bus.write(--this.data);
    this.z = +!this.data;
    this.n = this.data >>> 7;
    return 0;
  };

  // decrement x
  DEX = () => {
    --this.x;
    this.z = +!this.x;
    this.n = this.x >>> 7;
    return 0;
  };

  // decrement y
  DEY = () => {
    --this.yl
    this.z = +!this.y;
    this.n = this.y >>> 7;
    return 0;
  };

  // xor
  EOR = () => {
    this.a ^= this.data;
    this.z = +!this.a;
    this.n = this.a >>> 7;
    return 1;
  };

  // increment
  INC = () => {
    ++this.bus[this.bus.address];
    this.z = +!this.bus.read();
    this.n = this.bus.read() >>> 7;
    return 0;
  };

  // increment x
  INX = () => {
    ++this.x;
    this.z = +!this.x;
    this.n = this.x >>> 7;
    return 0;
  };

  // increment y
  INY = () => {
    ++this.y;
    this.z = +!this.y;
    this.n = this.y >>> 7;
    return 0;
  };

  // jump
  JMP = () => {
    this.pc = this.bus.address;
    return 0;
  };

  // gosub
  JSR = () => {
    --this.pc;
    this.tmp = this.bus.address;
    this.push(this.pc >>> 8);
    this.push(this.pc & 0xFF00);
    this.pc = this.tmp;
    return 0;
  };

  // load accumulator
  LDA = () => {
    this.a = this.data;
    this.z = +!this.a;
    this.n = this.a >>> 7;
    return 1;
  };

  // load x
  LDX = () => {
    this.x = this.data;
    this.z = +!this.x;
    this.n = this.x >>> 7;
    return 1;
  };

  // load y
  LDY = () => {
    this.y = this.data;
    this.z = +!this.y;
    this.n = this.y >>> 7;
  };

  // logical right shift
  LSR = () => {
    this.c = this.data & 0x01;
    this.data >>>= 1;
    this.z = +!this.data;
    this.n = 0;
    (this.op.addressmode == this.IMP && (this.a == this.data) || this.bus.write(this.data));
    return 0;
  };

  // no-op
  NOP = () => 0;

  // bitwise or
  ORA = () => {
    this.a |= this.data;
    this.z = +!this.a;
    this.n = this.a >>> 7;
    return 1;
  };

  // push accumulator
  PHA = () => {
    this.push(this.a);
    return 0;
  };

  // push status to stack
  PHP = () => {
    this.push(this.f | 0x30);  // status is pushed to stack with break set and the unused flag set
    this.b = 0;
    return 0;
  };

  // pop accumulator
  PLA = () => {
    this.a = this.pop();
    this.z = +!this.a;
    this.n = this.a >>> 7;
    return 0;
  };

  // pop status
  PLP = () => {
    this.f = this.pop();
    return 0;
  };

  // rotate left
  ROL = () => {
    this.tmp = this.data << 1;
    this.c = this.tmp >> 8;
    this.z = +!this.tmp;
    this.n = (this.tmp >> 7) & 0x01;
    (this.op.addressmode == this.IMP && (this.a = this.tmp) || this.bus.write(this.tmp));
    return 0;
  };

  // rotate right
  ROR = () => {
    this.tmp = (this.data >>> 1) | (this.c << 7);
    this.c = this.data & 0x01;
    this.z = +!this.tmp;
    this.n = this.tmp >>> 7;
    (this.op.addressmode == this.IMP && (this.a = this.tmp) || this.bus.write(this.tmp));
    return 0;
  };

  // return from irq
  RTI = () => {
    this.f = this.pop();
    this.b = 0;
    this.pc = this.pop() | (this.pop() << 8);
    this.advance();
    return 0;
  };

  // return from sub
  RTS = () => {
    this.pc = this.pop() | (this.pop() << 8);
    this.advance();
    return 0;
  };

  // subtraction with borrow
  SBC = () => {
    this.data ^= 0xFF;
    const res = this.a + this.data + this.c,
          res8 = res & 0xFF;
    this.v = ((this.a >>> 7) ^ (res8 >>> 7)) & ~((this.a >>> 7) ^ (this.data >>> 7)),
    this.n = res8 >>> 7,
    this.c = res >>> 8;
    this.a = this.res8;
    return 1;
  };

  // set carry
  SEC = () => (this.c = 1 && 0);

  // set decimal
  SED = () => (this.d == 1 && 0);

  // set interrupt
  SEI = () => (this.i = 1 && 0);

  // store accumulator
  STA = () => {
    this.bus.write(this.a);
    return 0;
  };

  // store x
  STX = () => {
    this.bus.write(this.x);
    return 0;
  };

  // store y
  STY = () => {
    this.bus.write(this.y);
    return 0;
  };

  // transfer a->x
  TAX = () => {
    this.x = this.a;
    this.z = +!this.x;
    this.n = this.x >>> 7;
    return 0;
  };

  // transfer a->y
  TAY = () => {
    this.y = this.a;
    this.z = +!this.y;
    this.n = this.y >>> 7;
    return 0;
  };

  // transfer sp->x
  TSX = () => {
    this.x = this.sp;
    this.z = +!this.x;
    this.n = this.x >>> 7;
    return 0;
  };

  // transfer x->a
  TXA = () => {
    this.a = this.x;
    this.z = +!this.a;
    this.n = this.a >>> 7;
    return 0;
  };

  // transfrer x->sp
  TXS = () => {
    this.sp = this.x;
    return 0;
  };

  TYA = () => {
    this.a = this.y;
    this.z = +!this.a;
    this.n = this.a >>> 7;
    return 0;
  };

  
};
