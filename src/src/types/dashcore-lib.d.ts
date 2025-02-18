declare namespace dashcore {
  class PrivateKey {
    constructor(key: string | Buffer);
    toAddress(): { toString(): string };
    toString(): string;
  }
  class Script {
    static fromAddress(addr: string): Script;
    toString(): string;
  }
  class Transaction {
    from(utxos: any[]): Transaction;
    to(addr: string, amountSatoshis: number): Transaction;
    sign(priv: PrivateKey): Transaction;
    serialize(): string;
  }
}

declare module 'dashcore-lib' {
  export = dashcore;
}
