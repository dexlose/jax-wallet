declare module 'react-sparklines' {
    import * as React from 'react';

    export interface SparklinesProps {
        data: number[];
        width?: number;
        height?: number;
        margin?: number;
        onMouseMove?: (e: React.MouseEvent<SVGElement, MouseEvent>) => void;
        onMouseLeave?: () => void;
        children?: React.ReactNode; 
    }

    export const Sparklines: React.FC<SparklinesProps>;

    export interface SparklinesLineProps {
        color?: string;
        style?: React.CSSProperties;
    }

    export const SparklinesLine: React.FC<SparklinesLineProps>;
}
