/**
 * CDN Service - CloudFront + S3 Integration
 * Manages static asset delivery with optimal caching headers
 */

import AWS from 'aws-sdk';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const CACHE_CONTROL_PRESETS = {
  // Images: 1 year (immutable hashes)
  'image/png': 'public, max-age=31536000, immutable',
  'image/jpeg': 'public, max-age=31536000, immutable',
  'image/webp': 'public, max-age=31536000, immutable',
  'image/svg+xml': 'public, max-age=31536000, immutable',
  'image/gif': 'public, max-age=31536000, immutable',

  // Fonts: 1 year (immutable)
  'font/woff': 'public, max-age=31536000, immutable',
  'font/woff2': 'public, max-age=31536000, immutable',
  'font/ttf': 'public, max-age=31536000, immutable',

  // CSS/JS: 1 day (hashed filenames)
  'text/css': 'public, max-age=86400',
  'application/javascript': 'public, max-age=86400',
  'application/json': 'public, max-age=3600',

  // HTML: 1 hour (revalidate)
  'text/html': 'public, max-age=3600, must-revalidate',

  // Default
  'default': 'public, max-age=3600',
};

const CONTENT_ENCODINGS = {
  '.js': ['gzip', 'br'],
  '.css': ['gzip', 'br'],
  '.json': ['gzip', 'br'],
  '.svg': ['gzip', 'br'],
  '.html': ['gzip', 'br'],
};

export class CDNService {
  constructor(config = {}) {
    this.s3Client = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });

    this.cloudfront = new AWS.CloudFront({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.bucket = process.env.AWS_S3_BUCKET_CDN || 'cdn-bucket';
    this.cloudfrontDistribution = process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID;
    this.cdnDomain = process.env.AWS_CDN_DOMAIN || `https://${this.bucket}.s3.amazonaws.com`;
    this.compressionThreshold = config.compressionThreshold || 1024; // 1KB
  }

  /**
   * Upload asset to S3 with optimal headers
   */
  async uploadAsset(filePath, fileContent, options = {}) {
    try {
      const ext = filePath.substring(filePath.lastIndexOf('.'));
      const mimeType = this.getMimeType(ext);
      const cacheControl = this.getCacheControl(mimeType);

      // Determine if should compress
      const shouldCompress = this.shouldCompress(ext, fileContent.length);
      let contentEncoding = null;
      let uploadContent = fileContent;

      if (shouldCompress) {
        // Prefer Brotli for text content
        if (ext === '.js' || ext === '.css' || ext === '.json' || ext === '.html') {
          uploadContent = await brotli(fileContent);
          contentEncoding = 'br';
        } else {
          uploadContent = await gzip(fileContent);
          contentEncoding = 'gzip';
        }
      }

      const params = {
        Bucket: this.bucket,
        Key: filePath.startsWith('/') ? filePath.substring(1) : filePath,
        Body: uploadContent,
        ContentType: mimeType,
        CacheControl: cacheControl,
        Metadata: {
          'original-size': fileContent.length.toString(),
          'compressed-size': uploadContent.length.toString(),
          'compression-ratio': ((1 - uploadContent.length / fileContent.length) * 100).toFixed(2),
        },
      };

      if (contentEncoding) {
        params.ContentEncoding = contentEncoding;
      }

      // Add versioning if provided
      if (options.version) {
        params.Metadata['version'] = options.version;
      }

      const result = await this.s3Client.upload(params).promise();

      console.log(`✅ Asset uploaded: ${filePath}`);
      console.log(`   Size: ${fileContent.length}b → ${uploadContent.length}b (${((1 - uploadContent.length / fileContent.length) * 100).toFixed(2)}% reduction)`);

      return {
        url: `${this.cdnDomain}/${result.Key}`,
        key: result.Key,
        etag: result.ETag,
        size: uploadContent.length,
        compression: contentEncoding,
      };
    } catch (error) {
      console.error(`❌ Upload asset error: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Batch upload multiple assets
   */
  async uploadAssets(assets) {
    const results = [];
    for (const asset of assets) {
      try {
        const result = await this.uploadAsset(asset.path, asset.content, asset.options);
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ success: false, path: asset.path, error: error.message });
      }
    }
    return results;
  }

  /**
   * Invalidate CloudFront cache
   */
  async invalidateCache(paths) {
    if (!this.cloudfrontDistribution) {
      console.warn('⚠️ CloudFront Distribution ID not configured');
      return null;
    }

    try {
      const params = {
        DistributionId: this.cloudfrontDistribution,
        InvalidationBatch: {
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
          CallerReference: `inv-${Date.now()}`,
        },
      };

      const result = await this.cloudfront.createInvalidation(params).promise();
      console.log(`✅ CloudFront invalidation: ${paths.join(', ')}`);
      return result.Invalidation.Id;
    } catch (error) {
      console.error('❌ CloudFront invalidation error:', error);
      throw error;
    }
  }

  /**
   * Get asset URL with CDN domain
   */
  getAssetUrl(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.cdnDomain}${cleanPath}`;
  }

  /**
   * Get MIME type from extension
   */
  getMimeType(ext) {
    const types = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Get cache control header
   */
  getCacheControl(mimeType) {
    return CACHE_CONTROL_PRESETS[mimeType] || CACHE_CONTROL_PRESETS['default'];
  }

  /**
   * Determine if file should be compressed
   */
  shouldCompress(ext, fileSize) {
    const compressible = CONTENT_ENCODINGS[ext];
    return compressible && fileSize > this.compressionThreshold;
  }

  /**
   * Get compression supported for extension
   */
  getCompressionMethods(ext) {
    return CONTENT_ENCODINGS[ext] || [];
  }

  /**
   * Batch invalidate by pattern (wildcard support)
   */
  async invalidatePattern(pattern) {
    if (!this.cloudfrontDistribution) {
      console.warn('⚠️ CloudFront Distribution ID not configured');
      return null;
    }

    try {
      // CloudFront supports wildcards
      const params = {
        DistributionId: this.cloudfrontDistribution,
        InvalidationBatch: {
          Paths: {
            Quantity: 1,
            Items: [pattern],
          },
          CallerReference: `inv-pattern-${Date.now()}`,
        },
      };

      const result = await this.cloudfront.createInvalidation(params).promise();
      console.log(`✅ CloudFront pattern invalidation: ${pattern}`);
      return result.Invalidation.Id;
    } catch (error) {
      console.error('❌ CloudFront pattern invalidation error:', error);
      throw error;
    }
  }

  /**
   * Get S3 object metadata
   */
  async getAssetMetadata(path) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: path.startsWith('/') ? path.substring(1) : path,
      };

      const result = await this.s3Client.headObject(params).promise();
      return {
        size: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        contentType: result.ContentType,
        cacheControl: result.CacheControl,
        contentEncoding: result.ContentEncoding,
        metadata: result.Metadata,
      };
    } catch (error) {
      console.error(`❌ Get metadata error: ${path}`, error);
      return null;
    }
  }

  /**
   * Delete asset from S3
   */
  async deleteAsset(path) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: path.startsWith('/') ? path.substring(1) : path,
      };

      await this.s3Client.deleteObject(params).promise();
      console.log(`✅ Asset deleted: ${path}`);

      // Invalidate CloudFront
      if (this.cloudfrontDistribution) {
        await this.invalidateCache([path.startsWith('/') ? path : `/${path}`]);
      }

      return true;
    } catch (error) {
      console.error(`❌ Delete asset error: ${path}`, error);
      throw error;
    }
  }

  /**
   * Get CDN stats
   */
  async getStats() {
    try {
      const params = {
        Bucket: this.bucket,
        MaxKeys: 1000,
      };

      const result = await this.s3Client.listObjects(params).promise();
      const objects = result.Contents || [];

      let totalSize = 0;
      let totalCompressed = 0;

      for (const obj of objects) {
        const metadata = await this.getAssetMetadata(`/${obj.Key}`).catch(() => null);
        if (metadata) {
          totalSize += metadata.size;
          totalCompressed += metadata.size; // Actual compressed size
        }
      }

      return {
        totalAssets: objects.length,
        totalSize,
        totalCompressed,
        compressionRatio: ((1 - totalCompressed / (totalSize || 1)) * 100).toFixed(2),
        cdnDomain: this.cdnDomain,
      };
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return null;
    }
  }
}

export const cdnService = new CDNService();

/**
 * Middleware: Serve assets from CDN
 */
export const cdnMiddleware = (req, res, next) => {
  try {
    // Only process static assets
    if (!req.path.match(/\.(js|css|json|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf)$/i)) {
      return next();
    }

    // Get asset URL from CDN
    const assetUrl = cdnService.getAssetUrl(req.path);
    
    // Set response header to direct to CDN
    res.set('X-CDN-URL', assetUrl);

    next();
  } catch (error) {
    console.error('❌ CDN middleware error:', error);
    next();
  }
};

export default cdnService;
