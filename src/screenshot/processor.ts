import sharp from "sharp";

export type ImageFormat = "png" | "jpeg" | "webp" | "tiff";

export interface ProcessingOptions {
  format?: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export class ImageProcessor {
  /**
   * Process an image buffer with various transformations
   */
  async processImage(
    imageBuffer: Buffer,
    options: ProcessingOptions
  ): Promise<Buffer> {
    let processor = sharp(imageBuffer);

    // Apply resize if width or height specified
    if (options.width || options.height) {
      processor = processor.resize(options.width, options.height);
    }

    // Apply crop if specified
    if (options.crop) {
      processor = processor.extract({
        left: options.crop.left,
        top: options.crop.top,
        width: options.crop.width,
        height: options.crop.height,
      });
    }

    // Set output format and quality
    switch (options.format) {
      case "jpeg":
        processor = processor.jpeg({ quality: options.quality || 80 });
        break;
      case "webp":
        processor = processor.webp({ quality: options.quality || 80 });
        break;
      case "tiff":
        processor = processor.tiff({ quality: options.quality || 80 });
        break;
      case "png":
      default:
        processor = processor.png();
        break;
    }

    return processor.toBuffer();
  }

  /**
   * Convert image format without other processing
   */
  async convertFormat(
    inputBuffer: Buffer,
    format: ImageFormat,
    quality: number = 80
  ): Promise<Buffer> {
    let sharpInstance = sharp(inputBuffer);

    switch (format) {
      case "png":
        return sharpInstance.png().toBuffer();
      case "jpeg":
        return sharpInstance.jpeg({ quality }).toBuffer();
      case "webp":
        return sharpInstance.webp({ quality }).toBuffer();
      case "tiff":
        return sharpInstance.tiff({ quality }).toBuffer();
      default:
        return inputBuffer;
    }
  }

  /**
   * Get image metadata
   */
  async getMetadata(imageBuffer: Buffer): Promise<sharp.Metadata> {
    return await sharp(imageBuffer).metadata();
  }
}

export default ImageProcessor;
