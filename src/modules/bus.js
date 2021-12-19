import MOS6502 from "./6502";
// proxy allows for fast access to bus locations by index.
const handler = {
  get: function(target, prop) {
    if(target.hasOwnProperty(prop)) return target[prop];
    if(typeof prop == 'number') {
      target.address = prop;
      return target.read();
    };
    return undefined;
  },
  set: function(target, prop, val) {
    if(target.hasOwnProperty(prop)) target[prop] = val;
    if(typeof prop == "number") {
      target.address = prop;
      target.write(val);
    };
  }
};

export default class Bus {
  constructor() {
    this._address = new Uint16Array(1);
    this.memory = new Uint8Array(0x0800);
  }

  get address() { return this._address[0]; }
  set address(val) { this._address[0] = val; }

  read = () => {
    if(this.address < 0x2000) return this.mem[this.address & 0x7FF];

    return undefined;
  };
  write = val => {
    if(this.address < 0x2000) this.mem[this.address & 0x7FF] = val;
  };

  
};
