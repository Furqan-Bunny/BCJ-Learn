// The browser build of mammoth ships no types for this subpath; declare the
// small surface we use (docx → HTML conversion in the client).
declare module "mammoth/mammoth.browser" {
  interface ConvertResult {
    value: string;
    messages: unknown[];
  }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<ConvertResult>;
  const mammoth: { convertToHtml: typeof convertToHtml };
  export default mammoth;
}
