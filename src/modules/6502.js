
export default class MOS6502 {
  constructor(bus) {
    this.bus = bus;
    this._registers = new Uint8Array(5);
    this._pc = new Uint16Array(1);
    this._data = new Uint8Array(1);
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

  get pc() { return this._pc[0]; }
  set pc(val) { this._pc[0] = val; }

  advance = () => this.pc++;

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

};
