// p5.brush ships no types; this covers the slice of the standalone build the
// masthead uses.
declare module "p5.brush/standalone" {
  export function createCanvas(
    width: number,
    height: number,
    options?: {
      pixelDensity?: number;
      parent?: string | Element | null;
      id?: string;
    }
  ): HTMLCanvasElement;
  export function load(target?: HTMLCanvasElement | OffscreenCanvas): void;
  export function clear(color?: string): void;
  export function render(): void;
  export function seed(seed: number): void;
  export function push(): void;
  export function pop(): void;
  export function translate(x: number, y: number): void;
  export function noStroke(): void;
  export function noHatch(): void;
  export function fill(color: string, opacity?: number): void;
  export function fillBleed(
    strength: number,
    direction?: "in" | "out",
    angle?: number
  ): void;
  export function fillTexture(
    textureStrength: number,
    borderIntensity: number,
    scatter?: boolean,
    split?: number
  ): void;
  export function polygon(points: number[][]): unknown;
}
