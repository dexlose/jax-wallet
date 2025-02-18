declare module 'coinselect' {
    export interface CoinSelectUtxo {
        txId: string;
        vout: number;
        value: number;
    }
    export interface CoinSelectOutput {
        address?: string;
        value: number;
    }
    export interface CoinSelectResult {
        inputs?: CoinSelectUtxo[];
        outputs?: CoinSelectOutput[];
        fee: number;
    }

    export default function coinselect(
        utxos: CoinSelectUtxo[],
        targets: CoinSelectOutput[],
        feeRate: number
    ): CoinSelectResult;
}
