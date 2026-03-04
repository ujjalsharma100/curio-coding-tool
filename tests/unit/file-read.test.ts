import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import * as fs from "node:fs/promises";
import pdfParse from "pdf-parse";
import { fileReadTool } from "../../src/tools/file-read.js";
import { toolSessionState } from "../../src/tools/session-state.js";

vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

const mockedPdfParse = pdfParse as unknown as ReturnType<typeof vi.fn>;

describe("Phase 2 file read tool", () => {
  const tmpDir = path.join(process.cwd(), "tests", "tmp-file-read");
  const baseFile = path.join(tmpDir, "file.txt");

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("reads text files with line numbers and truncation", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "a\nb\nc\n", "utf8");

    const result = await fileReadTool.execute({
      file_path: baseFile,
      offset: 2,
      limit: 1,
    } as never);

    expect(result).toContain("\t");
    expect(result).toContain("2\tb");
    expect(result).toContain("[truncated - 2 more lines]");
  });

  it("returns binary message when null bytes are detected", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const buf = Buffer.alloc(600);
    buf[100] = 0;
    const binaryPath = path.join(tmpDir, "binary.bin");
    await fs.writeFile(binaryPath, buf);

    const result = await fileReadTool.execute({
      file_path: binaryPath,
    } as never);

    expect(result).toBe("Binary file, cannot display");
  });

  it("returns image payload as base64 when vision is supported", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const imgPath = path.join(tmpDir, "image.png");
    const buffer = Buffer.from("image-data", "utf8");
    await fs.writeFile(imgPath, buffer);

    const result = await fileReadTool.execute({
      file_path: imgPath,
      supports_vision: true,
    } as never);

    const parsed = JSON.parse(String(result));
    expect(parsed.type).toBe("image_base64");
    expect(parsed.file_path).toBe(imgPath);
    expect(parsed.data).toBe(buffer.toString("base64"));
  });

  it("returns notebook rendering for .ipynb", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const nbPath = path.join(tmpDir, "notebook.ipynb");
    const nbJson = JSON.stringify({
      cells: [
        {
          cell_type: "code",
          source: ["print(1)\n"],
          outputs: [{ text: ["1\n"] }],
        },
      ],
    });
    await fs.writeFile(nbPath, nbJson, "utf8");

    const result = await fileReadTool.execute({
      file_path: nbPath,
    } as never);

    expect(result).toContain("[Cell 0 - code]");
    expect(result).toContain("print(1)");
    expect(result).toContain("[Output]");
    expect(result).toContain("1");
  });

  it("reads PDFs with page selection using pdf-parse", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const pdfPath = path.join(tmpDir, "doc.pdf");
    await fs.writeFile(pdfPath, "pdf-binary", "utf8");
    mockedPdfParse.mockResolvedValue({
      text: "page1\fpage2\fpage3",
    });

    const result = await fileReadTool.execute({
      file_path: pdfPath,
      pages: "2-3",
    } as never);

    expect(result).toContain("page2");
    expect(result).toContain("page3");
  });

  it("marks files as read in session state", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(baseFile, "content", "utf8");

    await fileReadTool.execute({
      file_path: baseFile,
    } as never);

    expect(toolSessionState.hasReadFile(baseFile)).toBe(true);
  });
});

