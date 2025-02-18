declare module "bchaddrjs" {
    export function toCashAddress(addr: string): string;
    export function isCashAddress(addr: string): boolean;
    export function toLegacyAddress(addr: string): string;
}
