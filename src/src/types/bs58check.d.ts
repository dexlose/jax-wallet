declare module 'bs58check' {
    function encode(buffer: Buffer | Uint8Array): string;
    function decode(str: string): Buffer;

    export { encode, decode };
    const _default: {
        encode: typeof encode;
        decode: typeof decode;
    };
    export default _default;
}
