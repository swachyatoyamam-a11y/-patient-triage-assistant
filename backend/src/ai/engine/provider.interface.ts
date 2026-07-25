/** Common contract so the analysis engine doesn't care which vendor answers. */
export interface AiProvider {
  readonly modelName: string;
  complete(system: string, user: string): Promise<string>;
}
